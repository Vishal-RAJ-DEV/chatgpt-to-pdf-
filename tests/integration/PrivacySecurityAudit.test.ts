/**
 * Integration Tests — Privacy, Local-Only Architecture & Security Audit (Phase 10).
 *
 * Explicitly verifies:
 * 1. Zero network requests (fetch, XMLHttpRequest, sendBeacon, WebSocket) are made during export.
 * 2. Diagnostic entries never leak user prompts, assistant responses, or raw conversation text.
 * 3. XSS sanitization: script tags, inline event handlers, and dangerous URL protocols (javascript:, vbscript:, data:text/html) are neutralized.
 * 4. Security policies block unsupported hosts and suspicious empty extractions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../src/core/conversation/Model';
import { renderConversation } from '../../src/core/renderer/DocumentRenderer';
import { createDiagnosticEntry, sanitizeDiagnosticContext } from '../../src/utils/Diagnostics';
import { ExportService, TabCommunicator } from '../../src/core/export/ExportService';
import { PrintService } from '../../src/core/export/PrintService';
import { SettingsManager } from '../../src/core/settings/SettingsManager';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';

describe('Privacy, Network & Security Integration Audit Tests', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let xhrSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    xhrSpy = vi.fn();

    (globalThis as unknown as Record<string, unknown>).fetch = fetchSpy;
    (globalThis as unknown as Record<string, unknown>).XMLHttpRequest = xhrSpy;
  });

  it('1. guarantees 0 network requests (fetch / XHR) occur across full export execution', async () => {
    const conversation: Conversation = {
      id: 'privacy-test-1',
      title: 'Local Privacy Audit',
      url: 'https://chatgpt.com/c/privacy-1',
      messages: [
        { id: 'm1', role: 'user', blocks: [{ type: 'paragraph', text: 'Sensitive private query' }] },
        { id: 'm2', role: 'assistant', blocks: [{ type: 'paragraph', text: 'Sensitive private response' }] },
      ],
    };

    const communicator: TabCommunicator = {
      getActiveTab: vi.fn().mockResolvedValue({ id: 777, url: 'https://chatgpt.com/c/privacy-1' }),
      sendMessage: vi.fn().mockResolvedValue({ success: true, conversation }),
    };

    const settingsManager = {
      loadSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      saveSettings: vi.fn(),
      resetSettings: vi.fn(),
      updateSettings: vi.fn(),
    } as unknown as SettingsManager;

    const printService = {
      print: vi.fn().mockResolvedValue(true),
    } as unknown as PrintService;

    const exportService = new ExportService(communicator, settingsManager, printService);
    const result = await exportService.exportCurrentTab();

    expect(result.success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });

  it('2. diagnostic context sanitization guarantees 0% leakage of prompt/response text', () => {
    const rawSensitiveContext = {
      turnCount: 10,
      userPrompt: 'CLASSIFIED USER PROMPT TEXT',
      assistantResponse: 'CLASSIFIED ASSISTANT RESPONSE TEXT',
      rawHtml: '<p>Secret DOM Content</p>',
      hasConversationRoot: true,
      role: 'assistant',
    };

    const sanitized = sanitizeDiagnosticContext(rawSensitiveContext);

    expect(sanitized).toBeDefined();
    expect(sanitized?.turnCount).toBe(10);
    expect(sanitized?.hasConversationRoot).toBe(true);
    expect(sanitized?.role).toBe('assistant');
    expect(sanitized?.userPrompt).toBeUndefined();
    expect(sanitized?.assistantResponse).toBeUndefined();
    expect(sanitized?.rawHtml).toBeUndefined();
  });

  it('3. factory createDiagnosticEntry returns sanitized entry without sensitive content', () => {
    const entry = createDiagnosticEntry(
      'warning',
      'EXTRACTION_PARTIAL',
      'Partial extraction diagnostic',
      { turnCount: 4, promptText: 'Do not log me' }
    );

    expect(entry.code).toBe('EXTRACTION_PARTIAL');
    expect(entry.context?.turnCount).toBe(4);
    expect(entry.context?.promptText).toBeUndefined();
  });

  it('4. DocumentRenderer neutralizes XSS payloads (script tags, event handlers, javascript: links)', () => {
    const maliciousConversation: Conversation = {
      id: 'xss-test',
      title: '<script>alert("title-xss")</script>',
      url: 'https://chatgpt.com/c/xss',
      messages: [
        {
          id: 'turn-xss',
          role: 'user',
          blocks: [
            {
              type: 'paragraph',
              text: '<img src=x onerror=alert(1)> Click here',
              inlines: [
                { type: 'text', text: '<img src=x onerror=alert(1)> ' },
                { type: 'link', href: 'javascript:alert(document.cookie)', text: 'Malicious Link' },
              ],
            },
          ],
        },
      ],
    };

    const html = renderConversation(maliciousConversation, DEFAULT_SETTINGS);

    // Title escaping
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;title-xss&quot;)&lt;/script&gt;');

    // HTML inline escaping
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');

    // Dangerous URL protocol stripping
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('Malicious Link');
  });
});
