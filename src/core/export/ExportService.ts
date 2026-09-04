/**
 * Export Orchestrator Service — Phase 6.
 *
 * Coordinates content script communication, conversation model extraction,
 * user settings loading, document rendering, and print surface invocation.
 */

import { isSupportedHost } from '../../adapters/chatgpt/ChatGPTAdapter';
import { Conversation } from '../conversation/Model';
import { renderConversation } from '../renderer/DocumentRenderer';
import { SettingsManager } from '../settings/SettingsManager';
import { toRenderOptions } from '../settings/toRenderOptions';
import { ExportError, ExportErrorCode } from './ExportErrors';
import { ExportResult, ExportState } from './ExportResult';
import { PrintService } from './PrintService';

export interface TabCommunicator {
  getActiveTab(): Promise<{ id?: number; url?: string }>;
  sendMessage<T>(tabId: number, message: unknown): Promise<T>;
}

/**
 * Extracts hostname from a full URL string safely.
 */
function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Default Chrome Tab Communicator implementation.
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
          if (lastErr.includes('Could not establish connection') || lastErr.includes('Receiving end does not exist')) {
            return reject(new ExportError(ExportErrorCode.UNSUPPORTED_PAGE, 'Open a ChatGPT conversation first.'));
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
   * Checks if given URL or current active tab is a supported ChatGPT page.
   * Parses hostname from full URL string before checking.
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
   * Runs end-to-end local PDF export orchestration.
   */
  public async exportCurrentTab(
    onStateChange?: (state: ExportState) => void
  ): Promise<ExportResult> {
    if (this.isExporting) {
      return {
        success: false,
        state: 'error',
        errorCode: ExportErrorCode.EXTRACTION_FAILED,
        errorUserMessage: 'Export failed. Please try again.',
        timestamp: new Date().toISOString(),
      };
    }

    this.isExporting = true;
    const notifyState = (state: ExportState) => {
      if (onStateChange) onStateChange(state);
    };

    try {
      // Step 1: Active Tab & Host Validation
      notifyState('extracting');
      const activeTab = await this.communicator.getActiveTab();

      if (!activeTab.id || !activeTab.url || !isSupportedHost(extractHostname(activeTab.url))) {
        throw new ExportError(ExportErrorCode.UNSUPPORTED_PAGE);
      }

      // Step 2: Request conversation extraction from Content Script
      interface ContentScriptResponse {
        success: boolean;
        conversation?: Conversation;
        error?: string;
        code?: string;
      }

      const response = await this.communicator.sendMessage<ContentScriptResponse>(activeTab.id, {
        action: 'EXTRACT_CONVERSATION',
      });

      if (!response || !response.success || !response.conversation) {
        if (response?.code === ExportErrorCode.STREAMING_IN_PROGRESS) {
          throw new ExportError(ExportErrorCode.STREAMING_IN_PROGRESS);
        }
        if (response?.code === ExportErrorCode.CONVERSATION_NOT_FOUND) {
          throw new ExportError(ExportErrorCode.CONVERSATION_NOT_FOUND);
        }
        throw new ExportError(ExportErrorCode.EXTRACTION_FAILED, response?.error);
      }

      const conversation = response.conversation;

      // Step 3: Load User Settings & derive RenderOptions
      notifyState('rendering');
      const userSettings = await this.settingsManager.loadSettings();
      const renderOptions = toRenderOptions(userSettings);

      // Step 4: Render standalone printable HTML
      const html = renderConversation(conversation, renderOptions);
      if (!html || !html.trim()) {
        throw new ExportError(ExportErrorCode.RENDER_FAILED);
      }

      // Step 5: Hand off printable HTML to local PrintService
      notifyState('printing');
      await this.printService.print(html);

      notifyState('success');
      return {
        success: true,
        state: 'success',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      notifyState('error');
      let exportErr: ExportError;

      if (err instanceof ExportError) {
        exportErr = err;
      } else {
        exportErr = new ExportError(ExportErrorCode.EXTRACTION_FAILED, String(err));
      }

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
