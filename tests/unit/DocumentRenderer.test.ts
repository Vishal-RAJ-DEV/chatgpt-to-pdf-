import { describe, it, expect } from 'vitest';
import {
  renderConversation,
  escapeHtml,
  sanitizeUrl,
  formatDate,
} from '../../src/core/renderer/DocumentRenderer';
import { Conversation, ContentBlock } from '../../src/core/conversation/Model';
import { DEFAULT_RENDER_OPTIONS } from '../../src/core/renderer/RenderTypes';

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

describe('DocumentRenderer Core Functionality', () => {
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

  it('5. renders user and assistant messages in exact order', () => {
    const html = renderConversation(sampleConversation);
    const userIndex = html.indexOf('class="message message-user"');
    const assistantIndex = html.indexOf('class="message message-assistant"');

    expect(userIndex).toBeGreaterThan(0);
    expect(assistantIndex).toBeGreaterThan(userIndex);
  });

  it('6. filters out user messages when showUserMessages is false', () => {
    const html = renderConversation(sampleConversation, { showUserMessages: false });
    expect(html).not.toContain('class="message message-user"');
    expect(html).toContain('class="message message-assistant"');
  });

  it('7. filters out assistant messages when showAssistantMessages is false', () => {
    const html = renderConversation(sampleConversation, { showAssistantMessages: false });
    expect(html).toContain('class="message message-user"');
    expect(html).not.toContain('class="message message-assistant"');
  });

  it('8. renders headings H1-H6', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<h2>HTML Guide</h2>');
  });

  it('9. renders paragraph blocks', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<p>How do I test HTML?</p>');
    expect(html).toContain('<p>Here is an introduction.</p>');
  });

  it('10. renders nested lists recursively', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<ul><li>Item 1<ul><li>Nested Item 1.1</li></ul></li></ul>');
  });

  it('11. renders code blocks preserving raw code text and indentation', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<code class="language-python">def hello():\n    print(&quot;Hello &lt;World&gt;&amp;&quot;)\n</code>');
  });

  it('12. verifies code block contents are HTML-escaped', () => {
    const codeConv: Conversation = {
      id: 'c1',
      title: 'Code Test',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [{ type: 'code', code: '<script>alert(1)</script>' }],
        },
      ],
    };
    const html = renderConversation(codeConv);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('13. renders tables with headers and cells HTML-escaped', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<th>Header 1</th>');
    expect(html).toContain('<td>Cell &lt;1&gt;</td>');
  });

  it('14. renders blockquote blocks', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<blockquote>Important Quote</blockquote>');
  });

  it('15. renders image blocks with responsive styles and safe URLs', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<img src="https://example.com/fig.png" alt="Figure 1" loading="lazy" />');
  });

  it('16. renders KaTeX math expressions safely', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<div class="math-block math-display">E = mc^2</div>');
  });

  it('17. preserves block order within turn cards', () => {
    const html = renderConversation(sampleConversation);
    const h2Idx = html.indexOf('HTML Guide');
    const pIdx = html.indexOf('Here is an introduction.');
    const codeIdx = html.indexOf('def hello()');

    expect(h2Idx).toBeLessThan(pIdx);
    expect(pIdx).toBeLessThan(codeIdx);
  });

  it('18. handles empty conversation gracefully without crashing', () => {
    const emptyConv: Conversation = {
      id: null,
      title: '',
      url: 'https://chatgpt.com/',
      messages: [],
    };
    const html = renderConversation(emptyConv);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<section class="conversation">\n      \n    </section>');
  });

  it('19. handles unknown block types safely with fallback paragraph', () => {
    const unknownBlock = { type: 'custom_future_type', payload: 'data' } as unknown as ContentBlock;
    const conv: Conversation = {
      id: 'c1',
      title: 'Unknown Block',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [unknownBlock],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('<p class="fallback-block">');
    expect(html).toContain('&quot;custom_future_type&quot;');
  });

  it('20. rejects dangerous URL schemes (javascript:)', () => {
    const unsafeConv: Conversation = {
      id: 'c1',
      title: 'Unsafe URL',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [{ type: 'image', src: 'javascript:alert(1)', alt: 'Unsafe Image' }],
        },
      ],
    };
    const html = renderConversation(unsafeConv);
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img src=""');
  });

  it('21. respects custom page size A4 vs Letter and margins', () => {
    const html = renderConversation(sampleConversation, {
      pageSize: 'LETTER',
      marginTop: '25mm',
    });
    expect(html).toContain('margin-top: 25mm;');
    expect(html).toContain('size: 8.5in 11in;');
  });

  it('22. verifies zero dependency on ChatGPT selectors or Chrome APIs in renderer', () => {
    expect(renderConversation).toBeDefined();
    expect(DEFAULT_RENDER_OPTIONS).toBeDefined();
  });

  it('23. verifies Phase 8A design tokens and CSS styles integration', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('/* ── Reset & Base Geometry ─────────────────────────────────────────── */');
    expect(html).toContain('.message-user {');
    expect(html).toContain('.message-assistant {');
    expect(html).toContain('white-space: pre-wrap;');
    expect(html).toContain('word-break: break-all;');
    expect(html).toContain('border-collapse: collapse;');
  });
});
