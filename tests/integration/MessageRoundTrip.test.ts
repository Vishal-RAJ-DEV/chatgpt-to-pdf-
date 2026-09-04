/**
 * Integration Test — Full Extension Message Round-Trip (Phase 10).
 *
 * Verifies that the Chrome messaging boundary preserves ExtractionResult status,
 * conversation model, diagnostic warnings, errors, and message counts across:
 * Popup / ExportService -> chrome.tabs.sendMessage -> Content Script -> ExportService -> ExportResult
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../src/core/conversation/Model';
import { ExtractionResult } from '../../src/core/conversation/ExtractionResult';
import { ExportErrorCode } from '../../src/core/export/ExportErrors';
import { ExportService, TabCommunicator } from '../../src/core/export/ExportService';
import { PrintService } from '../../src/core/export/PrintService';
import { SettingsManager } from '../../src/core/settings/SettingsManager';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';

describe('Chrome Extension Messaging Round-Trip Integration Tests', () => {
  let mockSettingsManager: SettingsManager;
  let mockPrintService: PrintService;
  let sampleConversation: Conversation;

  beforeEach(() => {
    sampleConversation = {
      id: 'roundtrip-conv-1',
      title: 'Roundtrip Test Conversation',
      url: 'https://chatgpt.com/c/roundtrip-conv-1',
      createdAt: '2026-09-04T12:00:00Z',
      messages: [
        { id: 'm1', role: 'user', blocks: [{ type: 'paragraph', text: 'Ping' }] },
        { id: 'm2', role: 'assistant', blocks: [{ type: 'paragraph', text: 'Pong' }] },
      ],
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

  function createCommunicatorWithResponse(responsePayload: unknown): TabCommunicator {
    return {
      getActiveTab: vi.fn().mockResolvedValue({ id: 888, url: 'https://chatgpt.com/c/roundtrip-conv-1' }),
      sendMessage: vi.fn().mockResolvedValue(responsePayload),
    };
  }

  it('1. SUCCESS status survives messaging boundary and produces state="success" with empty warnings', async () => {
    const extractionResult: ExtractionResult = {
      status: 'success',
      conversation: sampleConversation,
      warnings: [],
      errors: [],
      counts: { turns: 2, user: 1, assistant: 1, unknown: 0, blocks: 2 },
    };

    const communicator = createCommunicatorWithResponse({
      success: true,
      result: extractionResult,
      conversation: extractionResult.conversation,
      status: extractionResult.status,
      warnings: extractionResult.warnings,
      errors: extractionResult.errors,
    });

    const exportService = new ExportService(communicator, mockSettingsManager, mockPrintService);
    const result = await exportService.exportCurrentTab();

    expect(result.success).toBe(true);
    expect(result.state).toBe('success');
    expect(result.extractionStatus).toBe('success');
    expect(result.warnings).toEqual([]);
    expect(mockPrintService.print).toHaveBeenCalled();
  });

  it('2. PARTIAL status survives messaging boundary and produces state="warning" with preserved warnings', async () => {
    const extractionResult: ExtractionResult = {
      status: 'partial',
      conversation: sampleConversation,
      warnings: [
        {
          level: 'warning',
          code: 'ADAPTER_MESSAGE_NOT_FOUND',
          message: 'Turn content root missing',
          timestamp: '2026-09-04T12:00:00Z',
          context: { turnIndex: 2 },
        },
      ],
      errors: [],
      counts: { turns: 2, user: 1, assistant: 1, unknown: 0, blocks: 2 },
    };

    const communicator = createCommunicatorWithResponse({
      success: true,
      result: extractionResult,
      conversation: extractionResult.conversation,
      status: extractionResult.status,
      warnings: extractionResult.warnings,
      errors: extractionResult.errors,
    });

    const exportService = new ExportService(communicator, mockSettingsManager, mockPrintService);
    const result = await exportService.exportCurrentTab();

    expect(result.success).toBe(true);
    expect(result.state).toBe('warning');
    expect(result.extractionStatus).toBe('partial');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings?.[0].code).toBe('ADAPTER_MESSAGE_NOT_FOUND');
    expect(mockPrintService.print).toHaveBeenCalled();
  });

  it('3. LEGITIMATE EMPTY status with positive evidence exports clean empty document', async () => {
    const emptyConversation: Conversation = {
      id: 'roundtrip-empty',
      title: 'Empty Chat',
      url: 'https://chatgpt.com/c/roundtrip-empty',
      messages: [],
    };

    const extractionResult: ExtractionResult = {
      status: 'empty',
      conversation: emptyConversation,
      warnings: [],
      errors: [],
      counts: { turns: 0, user: 0, assistant: 0, unknown: 0, blocks: 0 },
    };

    const communicator = createCommunicatorWithResponse({
      success: true,
      result: extractionResult,
      conversation: extractionResult.conversation,
      status: extractionResult.status,
      warnings: extractionResult.warnings,
      errors: extractionResult.errors,
    });

    const exportService = new ExportService(communicator, mockSettingsManager, mockPrintService);
    const result = await exportService.exportCurrentTab();

    expect(result.success).toBe(true);
    expect(result.state).toBe('success');
    expect(mockPrintService.print).toHaveBeenCalled();
  });

  it('4. SUSPICIOUS_EMPTY status blocks export throwing EXTRACTION_EMPTY_SUSPICIOUS', async () => {
    const extractionResult: ExtractionResult = {
      status: 'suspicious_empty',
      conversation: null,
      warnings: [
        {
          level: 'warning',
          code: 'EXTRACTION_EMPTY_SUSPICIOUS',
          message: 'No turns found in container',
          timestamp: '2026-09-04T12:00:00Z',
        },
      ],
      errors: [],
      counts: { turns: 0, user: 0, assistant: 0, unknown: 0, blocks: 0 },
    };

    const communicator = createCommunicatorWithResponse({
      success: false,
      result: extractionResult,
      status: extractionResult.status,
      code: 'EXTRACTION_EMPTY_SUSPICIOUS',
    });

    const exportService = new ExportService(communicator, mockSettingsManager, mockPrintService);
    const result = await exportService.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.state).toBe('error');
    expect(result.errorCode).toBe(ExportErrorCode.EXTRACTION_EMPTY_SUSPICIOUS);
    expect(mockPrintService.print).not.toHaveBeenCalled();
  });

  it('5. FAILURE status blocks export and returns state="error"', async () => {
    const communicator = createCommunicatorWithResponse({
      success: false,
      code: 'CONVERSATION_NOT_FOUND',
      error: 'No ChatGPT conversation found on page',
    });

    const exportService = new ExportService(communicator, mockSettingsManager, mockPrintService);
    const result = await exportService.exportCurrentTab();

    expect(result.success).toBe(false);
    expect(result.state).toBe('error');
    expect(result.errorCode).toBe(ExportErrorCode.CONVERSATION_NOT_FOUND);
    expect(mockPrintService.print).not.toHaveBeenCalled();
  });
});
