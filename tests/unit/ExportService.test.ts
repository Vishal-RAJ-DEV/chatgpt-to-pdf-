/**
 * Unit Tests — ExportService Orchestrator (Phase 6).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../src/core/conversation/Model';
import { ExportErrorCode } from '../../src/core/export/ExportErrors';
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

  it('1. detects supported ChatGPT active tab', async () => {
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const isSupported = await service.checkSupport();
    expect(isSupported).toBe(true);
  });

  it('2. detects unsupported page active tab', async () => {
    mockCommunicator.getActiveTab = vi.fn().mockResolvedValue({ id: 102, url: 'https://example.com' });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const isSupported = await service.checkSupport();
    expect(isSupported).toBe(false);
  });

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

  it('4. rejects export on unsupported host URL', async () => {
    mockCommunicator.getActiveTab = vi.fn().mockResolvedValue({ id: 103, url: 'https://google.com' });
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);

    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.UNSUPPORTED_PAGE);
    expect(result.errorUserMessage).toBe('Open a ChatGPT conversation first.');
  });

  it('5. handles active streaming rejection from content script', async () => {
    mockCommunicator.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      code: 'STREAMING_IN_PROGRESS',
      error: 'Assistant is generating response',
    });

    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.STREAMING_IN_PROGRESS);
    expect(result.errorUserMessage).toBe('ChatGPT is still generating a response. Wait until it finishes.');
  });

  it('6. handles conversation not found rejection', async () => {
    mockCommunicator.sendMessage = vi.fn().mockResolvedValue({
      success: false,
      code: 'CONVERSATION_NOT_FOUND',
      error: 'No turns present in DOM',
    });

    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.CONVERSATION_NOT_FOUND);
    expect(result.errorUserMessage).toBe('Could not find a valid ChatGPT conversation on this page.');
  });

  it('7. handles extraction thrown errors cleanly', async () => {
    mockCommunicator.sendMessage = vi.fn().mockRejectedValue(new Error('Network error'));

    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.EXTRACTION_FAILED);
  });

  it('8. handles print service failure gracefully', async () => {
    mockPrintService.print = vi.fn().mockRejectedValue(new Error('Print blocked'));

    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    const result = await service.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ExportErrorCode.EXTRACTION_FAILED);
  });

  it('9. prevents concurrent duplicate export calls', async () => {
    // Make the extract step pause so the first export is mid-flight when second is triggered
    let resolveExtract: (val: unknown) => void = () => {};
    mockCommunicator.sendMessage = vi.fn().mockImplementation(
      () => new Promise((res) => { resolveExtract = res; })
    );

    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);

    // Start first export (hangs at extract step)
    const promise1 = service.exportCurrentTab();

    // Allow event loop to advance so isExporting=true is set
    await new Promise((r) => setTimeout(r, 10));

    // Second export: should be blocked immediately
    const result2 = await service.exportCurrentTab();
    expect(result2.success).toBe(false);
    expect(result2.errorUserMessage).toBe('Export failed. Please try again.');

    // Unblock the first export by resolving the extraction
    resolveExtract({ success: true, conversation: sampleConversation });
    mockPrintService.print = vi.fn().mockResolvedValue(true);

    const result1 = await promise1;
    expect(result1.success).toBe(true);
  });

  it('10. guarantees no conversation content is persisted to storage during export', async () => {
    const service = new ExportService(mockCommunicator, mockSettingsManager, mockPrintService);
    await service.exportCurrentTab();

    // Verify saveSettings was never called with conversation data
    expect(mockSettingsManager.saveSettings).not.toHaveBeenCalled();
  });
});
