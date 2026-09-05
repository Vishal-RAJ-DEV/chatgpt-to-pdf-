import { describe, it, expect } from 'vitest';
import { renderConversation } from '../../src/core/renderer/DocumentRenderer';
import { Conversation } from '../../src/core/conversation/Model';
import { UserSettings } from '../../src/core/settings/Settings';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';
import { toRenderOptions } from '../../src/core/settings/toRenderOptions';

describe('Settings Regression Matrix — 16 Configuration Tests', () => {
  const mockConversation: Conversation = {
    id: 'conv-123',
    title: 'Test Conversation Matrix',
    createdAt: '2026-09-05T09:00:00Z',
    url: 'https://chatgpt.com/c/123',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        blocks: [{ type: 'paragraph', text: 'Hello, explain quantum physics.' }],
      },
      {
        id: 'msg-2',
        role: 'assistant',
        blocks: [
          { type: 'paragraph', text: 'Quantum physics is the study of matter and energy at the most fundamental level.' },
          { type: 'code', language: 'python', code: 'def quantum():\n    return 42' },
        ],
      },
    ],
  };

  const matrix: Array<{ name: string; override: Partial<UserSettings> }> = [
    { name: 'A. default settings', override: {} },
    { name: 'B. page size changed', override: { pageSize: 'LETTER' } },
    { name: 'C. orientation changed', override: { orientation: 'landscape' } },
    { name: 'D. margins changed', override: { marginTop: '20mm', marginBottom: '20mm', marginLeft: '25mm', marginRight: '25mm' } },
    { name: 'E. font family changed', override: { fontFamily: 'Georgia, serif' } },
    { name: 'F. font size changed', override: { baseFontSize: '16px' } },
    { name: 'G. line height changed', override: { lineHeight: 1.8 } },
    { name: 'H. title visibility changed', override: { showConversationTitle: false } },
    { name: 'I. date visibility changed', override: { showDate: false } },
    { name: 'J. user-message visibility changed', override: { showUserMessages: false } },
    { name: 'K. assistant-message visibility changed', override: { showAssistantMessages: false } },
    { name: 'L. role visibility changed', override: { showRoleLabels: false } },
    { name: 'M. source visibility changed', override: { showConversationSource: false } },
    { name: 'N. page-number visibility changed', override: { showFooterPageNumbers: false } },
    { name: 'O. code theme changed', override: { codeTheme: 'light' } },
    { name: 'P. heading spacing changed', override: { headingSpacing: false } },
  ];

  matrix.forEach(({ name, override }) => {
    it(`verifies printable HTML and CSS generation for: ${name}`, () => {
      const mergedSettings: UserSettings = { ...DEFAULT_SETTINGS, ...override };
      const renderOpts = toRenderOptions(mergedSettings);
      const html = renderConversation(mockConversation, renderOpts);

      expect(html).toBeTruthy();
      expect(html).toContain('<!doctype html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('</html>');
      expect(html.length).toBeGreaterThan(500);
      expect(html).toContain('@page {');

      // Content verification
      if (override.showUserMessages !== false) {
        expect(html).toContain('Hello, explain quantum physics.');
      }
      if (override.showAssistantMessages !== false) {
        expect(html).toContain('Quantum physics is the study');
        expect(html).toContain('def quantum():');
      }
    });
  });
});
