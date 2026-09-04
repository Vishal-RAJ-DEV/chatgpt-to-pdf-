/**
 * Unit Tests — DocumentRenderer & Phase 8B Professional Conversation & Content Layout.
 */

import { describe, it, expect } from 'vitest';
import {
  renderConversation,
  escapeHtml,
  sanitizeUrl,
  formatDate,
} from '../../src/core/renderer/DocumentRenderer';
import { Conversation } from '../../src/core/conversation/Model';

describe('DocumentRenderer Security Helpers', () => {
  it('escapeHtml escapes HTML-special characters', () => {
    const raw = '<script>alert("XSS & Test")</script>';
    const escaped = escapeHtml(raw);
    expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS &amp; Test&quot;)&lt;/script&gt;');
  });

  it('sanitizeUrl rejects dangerous javascript:, vbscript:, data:text/html schemes', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('');
    expect(sanitizeUrl('vbscript:msgbox')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>')).toBe('');

    expect(sanitizeUrl('https://example.com/image.png')).toBe('https://example.com/image.png');
    expect(sanitizeUrl('/relative/path/img.png')).toBe('/relative/path/img.png');
  });

  it('formatDate formats ISO 8601 strings into human-readable text', () => {
    const formatted = formatDate('2026-09-04T10:00:00Z');
    expect(formatted).toContain('September 4, 2026');
  });
});

describe('DocumentRenderer Core & Phase 8B Content Layout Functionality', () => {
  const sampleConversation: Conversation = {
    id: 'conv-123',
    title: 'Comprehensive Test Chat',
    url: 'https://chatgpt.com/c/conv-123',
    createdAt: '2026-09-04T10:00:00Z',
    messages: [
      {
        id: 'turn-1',
        role: 'user',
        blocks: [{ type: 'paragraph', text: 'How do I test HTML?' }],
      },
      {
        id: 'turn-2',
        role: 'assistant',
        blocks: [
          { type: 'heading', level: 2, text: 'HTML Guide' },
          { type: 'paragraph', text: 'Here is an introduction.' },
          {
            type: 'list',
            ordered: false,
            items: [
              {
                text: 'Item 1',
                children: [{ text: 'Nested Item 1.1' }],
              },
            ],
          },
          {
            type: 'code',
            language: 'python',
            code: 'def hello():\n    print("Hello <World>&")\n',
          },
          {
            type: 'table',
            headers: ['Header 1', 'Header 2'],
            rows: [['Cell <1>', 'Cell 2']],
          },
          { type: 'quote', text: 'Important Quote' },
          { type: 'image', src: 'https://example.com/fig.png', alt: 'Figure 1' },
          { type: 'math', expression: 'E = mc^2', displayMode: true },
        ],
      },
    ],
  };

  it('1. renders valid standalone <!doctype html> document string', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('2. renders conversation title when showConversationTitle is true', () => {
    const html = renderConversation(sampleConversation, { showConversationTitle: true });
    expect(html).toContain('Comprehensive Test Chat');
  });

  it('3. hides conversation title when showConversationTitle is false', () => {
    const html = renderConversation(sampleConversation, { showConversationTitle: false });
    expect(html).not.toContain('<h1 class="document-title">');
  });

  it('4. renders formatted date when showDate is true', () => {
    const html = renderConversation(sampleConversation, { showDate: true });
    expect(html).toContain('Exported on September 4, 2026');
  });

  // ── Phase 8B Specific Requirements A-X ─────────────────────────────────────

  it('A. User message styling (.message-user)', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('article class="message message-user"');
    expect(html).toContain('<div class="message-role">User</div>');
  });

  it('B. Assistant message styling (.message-assistant)', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('article class="message message-assistant"');
    expect(html).toContain('<div class="message-role">Assistant</div>');
  });

  it('C. Multiple paragraphs rendering', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Paras',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [
            { type: 'paragraph', text: 'First paragraph.' },
            { type: 'paragraph', text: 'Second paragraph.' },
          ],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('<p>First paragraph.</p>');
    expect(html).toContain('<p>Second paragraph.</p>');
  });

  it('D. Heading hierarchy (H1-H6)', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Headings',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [
            { type: 'heading', level: 1, text: 'Heading 1' },
            { type: 'heading', level: 3, text: 'Heading 3' },
          ],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('<h1>Heading 1</h1>');
    expect(html).toContain('<h3>Heading 3</h3>');
  });

  it('E & F. Nested list semantic tags (ul & ol)', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Lists',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [
            {
              type: 'list',
              ordered: true,
              items: [{ text: 'Step 1', children: [{ text: 'Substep 1.1' }] }],
            },
          ],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('<ol><li>Step 1<ol><li>Substep 1.1</li></ol></li></ol>');
  });

  it('H. Code indentation preservation', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('def hello():\n    print(&quot;Hello &lt;World&gt;&amp;&quot;)\n');
  });

  it('I. Long code line CSS wrapping rules', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('overflow-wrap: break-word;');
    expect(html).toContain('word-break: break-word;');
  });

  it('K. Table rendering', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<div class="table-wrapper"><table><thead><tr><th>Header 1</th>');
    expect(html).toContain('<td>Cell &lt;1&gt;</td>');
  });

  it('L. Blockquote rendering', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<blockquote>Important Quote</blockquote>');
  });

  it('M. Image rendering', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<img src="https://example.com/fig.png" alt="Figure 1" loading="lazy" />');
  });

  it('N. Math rendering', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<div class="math-block math-display">E = mc^2</div>');
  });

  it('R & S. Role visibility filtering settings', () => {
    const noUserHtml = renderConversation(sampleConversation, { showUserMessages: false });
    expect(noUserHtml).not.toContain('<div class="message-role">User</div>');

    const noAssisHtml = renderConversation(sampleConversation, { showAssistantMessages: false });
    expect(noAssisHtml).not.toContain('<div class="message-role">Assistant</div>');
  });

  it('T, U, V. Font family, font size, and line height settings integration', () => {
    const customHtml = renderConversation(sampleConversation, {
      fontFamily: 'Arial, sans-serif',
      baseFontSize: '11pt',
      lineHeight: 1.6,
    });
    expect(customHtml).toContain('font-family: Arial, sans-serif;');
    expect(customHtml).toContain('font-size: 11pt;');
    expect(customHtml).toContain('line-height: 1.6;');
  });

  it('W. Code theme light/dark setting integration', () => {
    const lightHtml = renderConversation(sampleConversation, { codeTheme: 'light' });
    expect(lightHtml).toContain('background: #f8fafc;');

    const darkHtml = renderConversation(sampleConversation, { codeTheme: 'dark' });
    expect(darkHtml).toContain('background: #1e293b;');
  });

  it('X. Heading spacing setting integration', () => {
    const spacingHtml = renderConversation(sampleConversation, { headingSpacing: true });
    expect(spacingHtml).toContain('margin-top: 16px;');

    const noSpacingHtml = renderConversation(sampleConversation, { headingSpacing: false });
    expect(noSpacingHtml).toContain('margin-top: 8px;');
  });
});
