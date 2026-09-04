/**
 * Unit Tests — ExportService Orchestrator (Phase 6.1).
 *
 * Covers:
 *  1. Supported ChatGPT tab detection
 *  2. Unsupported page detection
 *  3. Full export workflow sequencing
 *  4. Unsupported host rejection
 *  5. Streaming in progress → STREAMING_IN_PROGRESS
 *  6. Conversation not found → CONVERSATION_NOT_FOUND
 *  7. Extraction network error → EXTRACTION_FAILED
 *  8. Print service generic failure → PRINT_FAILED
 *  9. Print timeout → PRINT_TIMEOUT
 * 10. Duplicate concurrent export → EXPORT_IN_PROGRESS
 * 11. No conversation content persisted to storage
 * 12. checkConversationReady: returns 'conversation' on health-check success
 * 13. checkConversationReady: returns 'chatgpt' when host ok but no conversation
 * 14. checkConversationReady: returns 'unsupported' for non-chatgpt host
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../src/core/conversation/Model';
import { ExportError, ExportErrorCode } from '../../src/core/export/ExportErrors';
import { ExportService, TabCommunicator } from '../../src/core/export/ExportService';
import { PrintService } from '../../src/core/export/PrintService';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';
import { SettingsManager } from '../../src/core/settings/SettingsManager';

describe('ExportService Orchestrator Unit Tests', () => {
  let mockCommunicator: TabCommunicator;
  let mockSettingsManager: SettingsManager;
  let mockPrintService: PrintService;
  let sampleConversation: Conversation;

  beforeEach(() => {
    sampleConversation = {
      id: 'test-conv-123',
      title: 'Sample Test Chat',
      url: 'https://chatgpt.com/c/123',
      messages: [
        { id: 'm1', role: 'user', blocks: [{ type: 'paragraph', text: 'Hello' }] },
        { id: 'm2', role: 'assistant', blocks: [{ type: 'paragraph', text: 'Hi back' }] },
      ],
    };

    mockCommunicator = {
      getActiveTab: vi.fn().mockResolvedValue({ id: 101, url: 'https://chatgpt.com/c/123' }),
      sendMessage: vi.fn().mockResolvedValue({ success: true, conversation: sampleConversation }),
    };

    mockSettingsManager = {
      loadSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      saveSettings: vi.fn(),
      resetSettings: vi.fn(),
      updateSettings: vi.fn(),
    } as unknown as SettingsManager;

    mockPrintService = {
      print: vi.fn().mockResolvedValue(true),
    } as unknown as PrintService;
  });

  // ── checkSupport ────────────────────────────────────────────────────────────

  it('1. detects supported ChatGPT active tab via checkSupport', async () => {
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    expect(await service.checkSupport()).toBe(true);
  });

  it('2. detects unsupported page active tab via checkSupport', async () => {
    mockCommunicator.getActiveTab = vi.fn().mockResolvedValue({ id: 102, url: 'https://example.com' });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    expect(await service.checkSupport()).toBe(false);
  });

  // ── Full workflow ───────────────────────────────────────────────────────────

  it('3. executes complete export workflow sequencing cleanly', async () => {
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const states: string[] = [];

    const result = await service.exportCurrentTab((state) => states.push(state));

    expect(result.success).toBe(true);
    expect(result.state).toBe('success');
    expect(states).toEqual(['extracting', 'rendering', 'printing', 'success']);
    expect(mockCommunicator.sendMessage).toHaveBeenCalledWith(101, { action: 'EXTRACT_CONVERSATION' });
    expect(mockSettingsManager.loadSettings).toHaveBeenCalled();
    expect(mockPrintService.print).toHaveBeenCalled();
  });

  // ── Stage-aware error codes ─────────────────────────────────────────────────

  it('4. rejects export on unsupported host URL → UNSUPPORTED_PAGE', async () => {
    mockCommunicator.getActiveTab = vi.fn().mockResolvedValue({ id: 103, url: 'https://google.com' });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.UNSUPPORTED_PAGE);
    expect(result.errorUserMessage).toBe('Open a ChatGPT conversation first.');
  });

  it('5. streaming in progress rejection → STREAMING_IN_PROGRESS', async () => {
    mockCommunicator.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      code: 'STREAMING_IN_PROGRESS',
      error: 'Assistant is generating response',
    });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.STREAMING_IN_PROGRESS);
  });

  it('6. conversation not found → CONVERSATION_NOT_FOUND', async () => {
    mockCommunicator.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      code: 'CONVERSATION_NOT_FOUND',
      error: 'No turns present in DOM',
    });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.CONVERSATION_NOT_FOUND);
  });

  it('7. extraction network error → EXTRACTION_FAILED', async () => {
    mockCommunicator.sendMessage = vi.fn().mockRejectedValue(new Error('Network error'));
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.EXTRACTION_FAILED);
  });

  it('8. print service generic failure → PRINT_FAILED (not EXTRACTION_FAILED)', async () => {
    mockPrintService.print = vi.fn().mockRejectedValue(
      new ExportError(ExportErrorCode.PRINT_FAILED, 'Popup blocked')
    );
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.PRINT_FAILED);
  });

  it('9. print timeout → PRINT_TIMEOUT (not EXTRACTION_FAILED)', async () => {
    mockPrintService.print = vi.fn().mockRejectedValue(
      new ExportError(ExportErrorCode.PRINT_TIMEOUT)
    );
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.PRINT_TIMEOUT);
  });

  // ── Duplicate export guard ──────────────────────────────────────────────────

  it('10. concurrent duplicate export → EXPORT_IN_PROGRESS', async () => {
    let resolveExtract: (val: unknown) => void = () => {};
    mockCommunicator.sendMessage = vi.fn().mockImplementation(
      () => new Promise((res) => { resolveExtract = res; })
    );

    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const promise1 = service.exportCurrentTab();

    // Let event loop advance so isExporting=true is set
    await new Promise((r) => setTimeout(r, 10));

    const result2 = await service.exportCurrentTab();
    expect(result2.success).toBe(false);
    expect(result2.errorCode).toBe(ExportErrorCode.EXPORT_IN_PROGRESS);
    expect(result2.errorUserMessage).toBe('An export is already running. Please wait.');

    // Unblock first export
    resolveExtract({ success: true, conversation: sampleConversation });
    mockPrintService.print = vi.fn().mockResolvedValue(true);
    const result1 = await promise1;
    expect(result1.success).toBe(true);
  });

  // ── Storage privacy ─────────────────────────────────────────────────────────

  it('11. guarantees no conversation content is persisted to storage', async () => {
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    await service.exportCurrentTab();
    expect(mockSettingsManager.saveSettings).not.toHaveBeenCalled();
  });

  // ── checkConversationReady ──────────────────────────────────────────────────

  it('12. checkConversationReady returns "conversation" when health check succeeds', async () => {
    mockCommunicator.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      health: { conversationDetected: true, turnCandidatesFound: true },
    });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    expect(await service.checkConversationReady()).toBe('conversation');
  });

  it('13. checkConversationReady returns "chatgpt" when on chatgpt.com but no conversation', async () => {
    mockCommunicator.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      health: { conversationDetected: false, turnCandidatesFound: false },
    });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    expect(await service.checkConversationReady()).toBe('chatgpt');
  });

  it('14. checkConversationReady returns "unsupported" for non-chatgpt host', async () => {
    mockCommunicator.getActiveTab = vi.fn().mockResolvedValue({ id: 999, url: 'https://google.com' });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    expect(await service.checkConversationReady()).toBe('unsupported');
  });

  it('15. blocks export when extraction status is suspicious_empty -> EXTRACTION_EMPTY_SUSPICIOUS', async () => {
    mockCommunicator.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      result: {
        status: 'suspicious_empty',
        conversation: null,
        warnings: [{ level: 'warning', code: 'EXTRACTION_EMPTY_SUSPICIOUS', message: 'Empty turns', timestamp: '2026-01-01' }],
        errors: [],
        counts: { turns: 0, user: 0, assistant: 0, unknown: 0, blocks: 0 },
      },
    });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.EXTRACTION_EMPTY_SUSPICIOUS);
  });

  it('16. allows safe export when extraction status is partial with warnings', async () => {
    mockCommunicator.sendMessage = vi.fn().mockResolvedValue({
      success: true,
      result: {
        status: 'partial',
        conversation: sampleConversation,
        warnings: [{ level: 'warning', code: 'ADAPTER_MESSAGE_NOT_FOUND', message: 'Missing root', timestamp: '2026-01-01' }],
        errors: [],
        counts: { turns: 2, user: 1, assistant: 1, unknown: 0, blocks: 2 },
      },
    });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(true);
    expect(mockPrintService.print).toHaveBeenCalled();
  });
});
