/**
 * Export Orchestrator Service — Phase 6.1.
 *
 * Coordinates content script communication, conversation model extraction,
 * user settings loading, document rendering, and print surface invocation.
 *
 * Error mapping (each stage maps to its own code):
 *   Host/tab check    → UNSUPPORTED_PAGE
 *   Content script    → STREAMING_IN_PROGRESS | CONVERSATION_NOT_FOUND | EXTRACTION_FAILED
 *   Renderer          → RENDER_FAILED
 *   Print surface     → PRINT_FAILED | PRINT_TIMEOUT  (ExportError preserved as-is)
 *   Unknown catch-all → EXTRACTION_FAILED
 */

import { isSupportedHost } from '../../adapters/chatgpt/ChatGPTAdapter';
import { ExtractionResult, ExtractionStatus } from '../conversation/ExtractionResult';
import { Conversation } from '../conversation/Model';
import { renderConversation } from '../renderer/DocumentRenderer';
import { SettingsManager } from '../settings/SettingsManager';
import { toRenderOptions } from '../settings/toRenderOptions';
import { ExportError, ExportErrorCode } from './ExportErrors';
import { ExportResult, ExportState } from './ExportResult';
import { PrintService } from './PrintService';
import { DiagnosticEntry } from '../../utils/Diagnostics';

export interface TabCommunicator {
  getActiveTab(): Promise<{ id?: number; url?: string }>;
  sendMessage<T>(tabId: number, message: unknown): Promise<T>;
}

/** Extracts hostname from a full URL string safely. */
function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/** Wraps a non-ExportError thrown during rendering into RENDER_FAILED. */
function asRenderError(err: unknown): ExportError {
  if (err instanceof ExportError) return err;
  return new ExportError(ExportErrorCode.RENDER_FAILED, String(err));
}

/** Wraps a non-ExportError thrown during printing into PRINT_FAILED. */
function asPrintError(err: unknown): ExportError {
  if (err instanceof ExportError) return err;
  return new ExportError(ExportErrorCode.PRINT_FAILED, String(err));
}

/**
 * Default Chrome Tab Communicator — real browser implementation.
 */
export class ChromeTabCommunicator implements TabCommunicator {
  public async getActiveTab(): Promise<{ id?: number; url?: string }> {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      throw new ExportError(ExportErrorCode.UNSUPPORTED_PAGE, 'Chrome Extension APIs unavailable.');
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          return reject(new ExportError(ExportErrorCode.UNSUPPORTED_PAGE, chrome.runtime.lastError.message));
        }
        if (!tabs || tabs.length === 0) {
          return reject(new ExportError(ExportErrorCode.UNSUPPORTED_PAGE, 'No active browser tab found.'));
        }
        resolve({ id: tabs[0].id, url: tabs[0].url });
      });
    });
  }

  public async sendMessage<T>(tabId: number, message: unknown): Promise<T> {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.sendMessage) {
      throw new ExportError(ExportErrorCode.UNSUPPORTED_PAGE, 'Chrome Messaging API unavailable.');
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          const lastErr = chrome.runtime.lastError.message || '';
          if (
            lastErr.includes('Could not establish connection') ||
            lastErr.includes('Receiving end does not exist')
          ) {
            return reject(
              new ExportError(ExportErrorCode.UNSUPPORTED_PAGE, 'Open a ChatGPT conversation first.')
            );
          }
          return reject(new ExportError(ExportErrorCode.EXTRACTION_FAILED, lastErr));
        }
        resolve(response as T);
      });
    });
  }
}

export class ExportService {
  private communicator: TabCommunicator;
  private settingsManager: SettingsManager;
  private printService: PrintService;
  private isExporting: boolean = false;

  constructor(
    communicator?: TabCommunicator,
    settingsManager?: SettingsManager,
    printService?: PrintService
  ) {
    this.communicator = communicator || new ChromeTabCommunicator();
    this.settingsManager = settingsManager || new SettingsManager();
    this.printService = printService || new PrintService();
  }

  /**
   * Checks whether the active tab (or given URL) is a supported ChatGPT host.
   * For a richer conversation-readiness check use checkConversationReady().
   */
  public async checkSupport(url?: string): Promise<boolean> {
    if (url) {
      return isSupportedHost(extractHostname(url));
    }
    try {
      const activeTab = await this.communicator.getActiveTab();
      return activeTab.url ? isSupportedHost(extractHostname(activeTab.url)) : false;
    } catch {
      return false;
    }
  }

  /**
   * Queries the content script health check to determine whether the active tab
   * is both a supported ChatGPT host AND has a detectable conversation in the DOM.
   *
   * Returns:
   *   'conversation' — supported host + conversation detected
   *   'chatgpt'      — supported host, no conversation (home/search page)
   *   'unsupported'  — not a supported host
   */
  public async checkConversationReady(): Promise<'conversation' | 'chatgpt' | 'unsupported'> {
    try {
      const activeTab = await this.communicator.getActiveTab();
      if (!activeTab.url || !isSupportedHost(extractHostname(activeTab.url))) {
        return 'unsupported';
      }
      if (!activeTab.id) return 'chatgpt';

      interface HealthResponse {
        success: boolean;
        health?: {
          conversationDetected: boolean;
          turnCandidatesFound: boolean;
        };
      }

      const response = await this.communicator.sendMessage<HealthResponse>(activeTab.id, {
        action: 'CHECK_HEALTH',
      });

      if (
        response?.success &&
        response.health?.conversationDetected &&
        response.health?.turnCandidatesFound
      ) {
        return 'conversation';
      }
      return 'chatgpt';
    } catch {
      return 'unsupported';
    }
  }

  /**
   * Runs end-to-end local PDF export orchestration.
   *
   * Error codes are stage-specific:
   *   extraction errors  → EXTRACTION_FAILED / STREAMING_IN_PROGRESS / CONVERSATION_NOT_FOUND
   *   render errors      → RENDER_FAILED
   *   print errors       → PRINT_FAILED / PRINT_TIMEOUT
   *   in-progress guard  → EXPORT_IN_PROGRESS
   */
  public async exportCurrentTab(
    onStateChange?: (state: ExportState) => void
  ): Promise<ExportResult> {
    if (this.isExporting) {
      const err = new ExportError(ExportErrorCode.EXPORT_IN_PROGRESS);
      return {
        success: false,
        state: 'error',
        errorCode: err.code,
        errorUserMessage: err.userMessage,
        timestamp: new Date().toISOString(),
      };
    }

    this.isExporting = true;
    const notifyState = (state: ExportState) => {
      if (onStateChange) onStateChange(state);
    };

    try {
      // ── Stage 1: Active Tab & Host Validation ──────────────────────────────
      notifyState('extracting');
      const activeTab = await this.communicator.getActiveTab();

      if (!activeTab.id || !activeTab.url || !isSupportedHost(extractHostname(activeTab.url))) {
        throw new ExportError(ExportErrorCode.UNSUPPORTED_PAGE);
      }

      // ── Stage 2: Conversation Extraction via Content Script ────────────────
      interface ContentScriptResponse {
        success: boolean;
        result?: ExtractionResult;
        conversation?: Conversation;
        status?: ExtractionStatus;
        warnings?: readonly DiagnosticEntry[];
        errors?: readonly DiagnosticEntry[];
        error?: string;
        code?: string;
      }

      let response: ContentScriptResponse;
      try {
        response = await this.communicator.sendMessage<ContentScriptResponse>(activeTab.id, {
          action: 'EXTRACT_CONVERSATION',
        });
      } catch (err) {
        // Re-throw ExportErrors (e.g. UNSUPPORTED_PAGE from communicator) as-is
        if (err instanceof ExportError) throw err;
        throw new ExportError(ExportErrorCode.EXTRACTION_FAILED, String(err));
      }

      const status = response?.result?.status || response?.status;

      if (
        status === 'suspicious_empty' ||
        response?.code === ExportErrorCode.EXTRACTION_EMPTY_SUSPICIOUS ||
        response?.code === 'EXTRACTION_EMPTY_SUSPICIOUS'
      ) {
        throw new ExportError(ExportErrorCode.EXTRACTION_EMPTY_SUSPICIOUS);
      }

      if (response?.code === ExportErrorCode.STREAMING_IN_PROGRESS || response?.code === 'STREAMING_IN_PROGRESS') {
        throw new ExportError(ExportErrorCode.STREAMING_IN_PROGRESS);
      }
      if (response?.code === ExportErrorCode.CONVERSATION_NOT_FOUND || response?.code === 'CONVERSATION_NOT_FOUND') {
        throw new ExportError(ExportErrorCode.CONVERSATION_NOT_FOUND);
      }
      if (response?.code === 'INCOMPLETE_CONVERSATION' || response?.code === 'LONG_CONVERSATION_TIMEOUT') {
        throw new ExportError(ExportErrorCode.CONVERSATION_INCOMPLETE);
      }

      if (!response || (!response.success && status !== 'empty')) {
        throw new ExportError(ExportErrorCode.EXTRACTION_FAILED, response?.error);
      }

      let conversation = response.result?.conversation || response.conversation;

      if (!conversation) {
        if (status === 'empty') {
          conversation = {
            id: null,
            title: 'ChatGPT Conversation',
            url: activeTab.url || 'https://chatgpt.com',
            createdAt: new Date().toISOString(),
            messages: [],
            metadata: {
              source: 'chatgpt.com',
              extractedAt: new Date().toISOString(),
              adapterVersion: '0.1.0',
              confidence: 'high',
            },
          };
        } else {
          throw new ExportError(ExportErrorCode.EXTRACTION_FAILED, response?.error);
        }
      }

      // ── Stage 3: Settings Loading & Rendering ──────────────────────────────
      notifyState('rendering');
      let html: string;
      try {
        const userSettings = await this.settingsManager.loadSettings();
        const renderOptions = toRenderOptions(userSettings);
        html = renderConversation(conversation, renderOptions);
        if (!html || !html.trim()) {
          throw new ExportError(ExportErrorCode.RENDER_FAILED);
        }
      } catch (err) {
        throw asRenderError(err);
      }

      // ── Stage 4: Print Surface ─────────────────────────────────────────────
      notifyState('printing');
      try {
        await this.printService.print(html);
      } catch (err) {
        throw asPrintError(err);
      }

      notifyState('success');
      return {
        success: true,
        state: 'success',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      notifyState('error');
      const exportErr =
        err instanceof ExportError
          ? err
          : new ExportError(ExportErrorCode.EXTRACTION_FAILED, String(err));

      return {
        success: false,
        state: 'error',
        errorCode: exportErr.code,
        errorUserMessage: exportErr.userMessage,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.isExporting = false;
    }
  }
}
