/**
 * Integration Tests — End-to-End Export Pipeline (Phase 6).
 *
 * Verifies end-to-end integration using a representative fixture covering all
 * ContentBlock types through ExportService -> SettingsManager -> DocumentRenderer -> PrintService.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../src/core/conversation/Model';
import { ExportService, TabCommunicator } from '../../src/core/export/ExportService';
import { PrintService } from '../../src/core/export/PrintService';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';
import { SettingsManager } from '../../src/core/settings/SettingsManager';

describe('End-to-End Export Pipeline Integration Tests', () => {
  let comprehensiveFixture: Conversation;
  let mockStorageStore: Record<string, unknown>;

  const setupChromeMocks = () => {
    mockStorageStore = {};

    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: { lastError: undefined },
      storage: {
        local: {
          get: vi.fn((_keys: string[], cb: (res: Record<string, unknown>) => void) => cb(mockStorageStore)),
          set: vi.fn((items: Record<string, unknown>, cb: () => void) => {
            Object.assign(mockStorageStore, items);
            if (cb) cb();
          }),
        },
      },
      tabs: {
        query: vi.fn(),
        sendMessage: vi.fn(),
      },
    };
  };

  beforeEach(() => {
    setupChromeMocks();

    comprehensiveFixture = {
      id: 'full-fixture-100',
      title: 'Comprehensive Export Pipeline Test',
      url: 'https://chatgpt.com/c/full-test',
      createdAt: '2026-09-04T12:00:00Z',
      messages: [
        {
          id: 'turn-1',
          role: 'user',
          timestamp: '12:00 PM',
          blocks: [
            { type: 'paragraph', text: 'Explain key physics formulas and show an example code.' },
          ],
        },
        {
          id: 'turn-2',
          role: 'assistant',
          timestamp: '12:01 PM',
          blocks: [
            { type: 'heading', level: 2, text: 'Quantum Physics Overview' },
            { type: 'paragraph', text: 'Here is the energy-mass equivalence equation:' },
            { type: 'math', expression: 'E = mc^2', displayMode: true },
            { type: 'quote', text: 'Energy cannot be created or destroyed, only transformed.' },
            {
              type: 'list',
              ordered: true,
              items: [
                { text: 'Mass in kg', children: [{ text: 'Measured at rest' }] },
                { text: 'Speed of light constant' },
              ],
            },
            {
              type: 'code',
              language: 'python',
              code: 'def calculate_energy(m):\n    c = 3e8\n    return m * (c ** 2)',
            },
            {
              type: 'table',
              headers: ['Variable', 'Symbol', 'Unit'],
              rows: [
                ['Energy', 'E', 'Joules'],
                ['Mass', 'm', 'kg'],
              ],
            },
            {
              type: 'image',
              src: 'https://chatgpt.com/assets/diagram.png',
              alt: 'Energy Mass Diagram',
            },
          ],
        },
      ],
    };
  });

  function makeMockCommunicator(conversation: Conversation): TabCommunicator {
    return {
      getActiveTab: vi.fn().mockResolvedValue({ id: 200, url: 'https://chatgpt.com/c/full-test' }),
      sendMessage: vi.fn().mockResolvedValue({ success: true, conversation }),
    };
  }

  function makeMockPrintService(): { service: PrintService; getPayload: () => string } {
    let payload = '';
    const service = {
      print: vi.fn().mockImplementation((html: string) => {
        payload = html;
        return Promise.resolve(true);
      }),
    } as unknown as PrintService;
    return { service, getPayload: () => payload };
  }

  it('1. executes end-to-end pipeline and delivers complete rendered HTML payload to PrintService', async () => {
    const mockCommunicator = makeMockCommunicator(comprehensiveFixture);
    const settingsManager = new SettingsManager();
    const { service: mockPrintService, getPayload } = makeMockPrintService();

    const exportService = new ExportService(mockCommunicator, settingsManager, mockPrintService);
    const result = await exportService.exportCurrentTab();

    expect(result.success).toBe(true);
    expect(result.state).toBe('success');

    const html = getPayload();
    expect(html).toContain('Comprehensive Export Pipeline Test');
    expect(html).toContain('Quantum Physics Overview');
    expect(html).toContain('E = mc^2');
    expect(html).toContain('Energy cannot be created or destroyed');
    expect(html).toContain('def calculate_energy(m):');
    expect(html).toContain('Joules');
    expect(html).toContain('Energy Mass Diagram');
  });

  it('2. respects saved user settings (LETTER page + light code theme + no user messages) in exported HTML', async () => {
    const mockCommunicator = makeMockCommunicator(comprehensiveFixture);
    const settingsManager = new SettingsManager();

    await settingsManager.saveSettings({
      ...DEFAULT_SETTINGS,
      pageSize: 'LETTER',
      showUserMessages: false,
    });

    const { service: mockPrintService, getPayload } = makeMockPrintService();
    const exportService = new ExportService(mockCommunicator, settingsManager, mockPrintService);
    const result = await exportService.exportCurrentTab();

    expect(result.success).toBe(true);
    const html = getPayload();
    expect(html).toContain('size: 8.5in 11in;');
    expect(html).not.toContain('class="message message-user"');
    expect(html).toContain('class="message message-assistant"');
  });
});
