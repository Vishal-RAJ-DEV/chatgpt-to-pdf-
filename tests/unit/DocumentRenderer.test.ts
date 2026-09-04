/**
 * Unit Tests — DocumentRenderer & Phase 8B Professional Conversation & Content Layout Hardening.
 */

import { describe, it, expect } from 'vitest';
import {
  renderConversation,
  escapeHtml,
  sanitizeUrl,
  formatDate,
  parseInlineText,
  renderInlineText,
} from '../../src/core/renderer/DocumentRenderer';
import { Conversation, ContentBlock } from '../../src/core/conversation/Model';

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

describe('DocumentRenderer Inline Content Parsing & Rendering', () => {
  it('parseInlineText parses plain text, inline code, links, and autolinks', () => {
    const text = 'Check `const x = 1;` and [Google](https://google.com) or https://example.com directly.';
    const nodes = parseInlineText(text);

    expect(nodes).toEqual([
      { type: 'text', text: 'Check ' },
      { type: 'code', code: 'const x = 1;' },
      { type: 'text', text: ' and ' },
      { type: 'link', href: 'https://google.com', text: 'Google' },
      { type: 'text', text: ' or ' },
      { type: 'link', href: 'https://example.com', text: 'https://example.com' },
      { type: 'text', text: ' directly.' },
    ]);
  });

  it('renderInlineText renders inline nodes with HTML escaping and URL sanitization', () => {
    const html = renderInlineText('Check `alert("<XSS>")` and [Malicious](javascript:alert(1))');
    expect(html).toContain('<code>alert(&quot;&lt;XSS&gt;&quot;)</code>');
    expect(html).toContain('Malicious');
    expect(html).not.toContain('href="javascript:');
  });
});

describe('DocumentRenderer Full Regression Suite (All 36 Scenarios)', () => {
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
          { type: 'paragraph', text: 'Here is an introduction with `inline code` and a [Link](https://example.com).' },
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

  it('1. valid standalone HTML document', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('2. title rendering', () => {
    const html = renderConversation(sampleConversation, { showConversationTitle: true });
    expect(html).toContain('<title>Comprehensive Test Chat</title>');
    expect(html).toContain('<h1 class="document-title">Comprehensive Test Chat</h1>');
  });

  it('3. title visibility setting', () => {
    const html = renderConversation(sampleConversation, { showConversationTitle: false });
    expect(html).not.toContain('<h1 class="document-title">');
  });

  it('4. date rendering', () => {
    const html = renderConversation(sampleConversation, { showDate: true });
    expect(html).toContain('Exported on September 4, 2026');
  });

  it('5. user + assistant ordering', () => {
    const html = renderConversation(sampleConversation);
    const userIndex = html.indexOf('class="message message-user"');
    const assistantIndex = html.indexOf('class="message message-assistant"');
    expect(userIndex).toBeGreaterThan(-1);
    expect(assistantIndex).toBeGreaterThan(userIndex);
  });

  it('6. user message visibility filtering', () => {
    const html = renderConversation(sampleConversation, { showUserMessages: false });
    expect(html).not.toContain('class="message message-user"');
    expect(html).toContain('class="message message-assistant"');
  });

  it('7. assistant message visibility filtering', () => {
    const html = renderConversation(sampleConversation, { showAssistantMessages: false });
    expect(html).toContain('class="message message-user"');
    expect(html).not.toContain('class="message message-assistant"');
  });

  it('8. H1-H6 rendering', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Headings',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [
            { type: 'heading', level: 1, text: 'H1 Title' },
            { type: 'heading', level: 2, text: 'H2 Title' },
            { type: 'heading', level: 3, text: 'H3 Title' },
            { type: 'heading', level: 4, text: 'H4 Title' },
            { type: 'heading', level: 5, text: 'H5 Title' },
            { type: 'heading', level: 6, text: 'H6 Title' },
          ],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('<h1>H1 Title</h1>');
    expect(html).toContain('<h2>H2 Title</h2>');
    expect(html).toContain('<h3>H3 Title</h3>');
    expect(html).toContain('<h4>H4 Title</h4>');
    expect(html).toContain('<h5>H5 Title</h5>');
    expect(html).toContain('<h6>H6 Title</h6>');
  });

  it('9. paragraph rendering', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<p>How do I test HTML?</p>');
  });

  it('10. nested unordered lists without text duplication', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'UL List',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [
            {
              type: 'list',
              ordered: false,
              items: [{ text: 'Parent Item', children: [{ text: 'Child Item' }] }],
            },
          ],
        },
      ],
    };
    const html = renderConversation(conv);
    const parentMatches = (html.match(/Parent Item/g) || []).length;
    const childMatches = (html.match(/Child Item/g) || []).length;

    expect(parentMatches).toBe(1);
    expect(childMatches).toBe(1);
    expect(html).toContain('<ul><li>Parent Item<ul><li>Child Item</li></ul></li></ul>');
  });

  it('11. nested ordered lists', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'OL List',
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

  it('12. mixed nested list behavior (ul -> ol and ol -> ul)', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Mixed Lists',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [
            {
              type: 'list',
              ordered: false,
              items: [{ text: 'Bullet', ordered: true, children: [{ text: 'Numbered Sub-item' }] }],
            },
            {
              type: 'list',
              ordered: true,
              items: [{ text: 'Step', ordered: false, children: [{ text: 'Bullet Sub-item' }] }],
            },
          ],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('<ul><li>Bullet<ol><li>Numbered Sub-item</li></ol></li></ul>');
    expect(html).toContain('<ol><li>Step<ul><li>Bullet Sub-item</li></ul></li></ol>');
  });

  it('13. exact block ordering', () => {
    const html = renderConversation(sampleConversation);
    const h2Idx = html.indexOf('<h2>HTML Guide</h2>');
    const codeIdx = html.indexOf('<div class="code-wrapper">');
    const tableIdx = html.indexOf('<div class="table-wrapper">');
    expect(h2Idx).toBeGreaterThan(-1);
    expect(codeIdx).toBeGreaterThan(h2Idx);
    expect(tableIdx).toBeGreaterThan(codeIdx);
  });

  it('14. code indentation preservation', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('def hello():\n    print(&quot;Hello &lt;World&gt;&amp;&quot;)\n');
  });

  it('15. code HTML escaping', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Unsafe Code',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [{ type: 'code', code: '<script>alert("XSS")</script>' }],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('16. table headers/cells', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<table><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead>');
    expect(html).toContain('<tbody><tr><td>Cell &lt;1&gt;</td><td>Cell 2</td></tr></tbody>');
  });

  it('17. table HTML escaping', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Table Escape',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [
            {
              type: 'table',
              headers: ['<Header>'],
              rows: [['<Cell>']],
            },
          ],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('<th>&lt;Header&gt;</th>');
    expect(html).toContain('<td>&lt;Cell&gt;</td>');
  });

  it('18. blockquotes', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<blockquote>Important Quote</blockquote>');
  });

  it('19. image rendering', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<div class="image-wrapper"><img src="https://example.com/fig.png" alt="Figure 1" /><div class="image-caption">Figure 1</div></div>');
  });

  it('20. unsafe image URL rejection', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Unsafe Image',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [{ type: 'image', src: 'javascript:alert(1)', alt: 'Bad Image' }],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).not.toContain('src="javascript:');
    expect(html).not.toContain('<img');
  });

  it('21. math rendering', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<div class="math-block math-display">E = mc^2</div>');
  });

  it('22. empty conversation', () => {
    const emptyConv: Conversation = {
      id: 'c-empty',
      title: 'Empty Chat',
      url: 'https://chatgpt.com/',
      messages: [],
    };
    const html = renderConversation(emptyConv);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<section class="conversation">');
    expect(html).toContain('</section>');
  });

  it('23. unknown-block fallback', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Unknown',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [{ type: 'custom_unknown' } as unknown as ContentBlock],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('<p class="fallback-block">');
    expect(html).toContain('&quot;type&quot;:&quot;custom_unknown&quot;');
  });

  it('24. page size setting', () => {
    const letterHtml = renderConversation(sampleConversation, { pageSize: 'LETTER' });
    expect(letterHtml).toContain('@page {\n      size: 8.5in 11in;');
  });

  it('25. margin setting', () => {
    const customMarginHtml = renderConversation(sampleConversation, { marginTop: '25mm' });
    expect(customMarginHtml).toContain('margin-top: 25mm;');
  });

  it('26. font family setting', () => {
    const fontHtml = renderConversation(sampleConversation, { fontFamily: 'Georgia, serif' });
    expect(fontHtml).toContain('font-family: Georgia, serif;');
  });

  it('27. base font size setting', () => {
    const fontSizeHtml = renderConversation(sampleConversation, { baseFontSize: '12pt' });
    expect(fontSizeHtml).toContain('font-size: 12pt;');
  });

  it('28. line-height setting', () => {
    const lhHtml = renderConversation(sampleConversation, { lineHeight: 1.8 });
    expect(lhHtml).toContain('line-height: 1.8;');
  });

  it('29. code theme setting', () => {
    const darkHtml = renderConversation(sampleConversation, { codeTheme: 'dark' });
    expect(darkHtml).toContain('background: #1e293b;');
  });

  it('30. heading spacing setting', () => {
    const spacingHtml = renderConversation(sampleConversation, { headingSpacing: true });
    expect(spacingHtml).toContain('margin-top: 16px;');
  });

  it('31. renderer remains independent from Chrome APIs / ChatGPT selectors', () => {
    const html = renderConversation(sampleConversation);
    expect(html).not.toContain('chrome-extension://');
    expect(html).not.toContain('[data-testid=');
  });

  it('32. inline code rendering', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Inline Code',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [{ type: 'paragraph', text: 'Use `npm test` to run tests.' }],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('<p>Use <code>npm test</code> to run tests.</p>');
  });

  it('33. inline link rendering', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Inline Link',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [{ type: 'paragraph', text: 'Visit [GitHub](https://github.com) now.' }],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain('<p>Visit <a href="https://github.com">GitHub</a> now.</p>');
  });

  it('34. mixed inline content rendering', () => {
    const conv: Conversation = {
      id: 'c1',
      title: 'Mixed Inline',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [
            {
              type: 'paragraph',
              text: 'Normal text + `inline code` + [Link Text](https://example.com) + extra text.',
            },
          ],
        },
      ],
    };
    const html = renderConversation(conv);
    expect(html).toContain(
      '<p>Normal text + <code>inline code</code> + <a href="https://example.com">Link Text</a> + extra text.</p>'
    );
  });

  it('35. long URL safety/wrapping behavior', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('a {\n      color: #2563eb;\n      text-decoration: underline;\n      overflow-wrap: break-word;\n      word-break: break-word;\n    }');
  });

  it('36. image output does not use lazy loading', () => {
    const html = renderConversation(sampleConversation);
    expect(html).toContain('<img src="https://example.com/fig.png" alt="Figure 1" />');
    expect(html).not.toContain('loading="lazy"');
  });
});

describe('Phase 8C Pagination & Page-Break Engineering (All 17 Scenarios)', () => {
  const testConv: Conversation = {
    id: 'c-pag',
    title: 'Pagination Test Conversation',
    url: 'https://chatgpt.com/c/c-pag',
    createdAt: '2026-09-04T12:00:00Z',
    messages: [
      {
        id: 't1',
        role: 'user',
        blocks: [{ type: 'paragraph', text: 'Prompt text' }],
      },
      {
        id: 't2',
        role: 'assistant',
        blocks: [
          { type: 'heading', level: 2, text: 'Technical Response Heading' },
          { type: 'paragraph', text: 'Paragraph content for pagination testing.' },
          { type: 'code', language: 'typescript', code: 'const a = 1;' },
          { type: 'table', headers: ['Col A'], rows: [['Val A']] },
          { type: 'image', src: 'https://example.com/img.png', alt: 'Test Img' },
          { type: 'math', expression: 'x^2', displayMode: true },
        ],
      },
    ],
  };

  it('P1. document header avoids awkward page break (break-after: avoid)', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('.document-header {');
    expect(html).toContain('break-after: avoid;');
  });

  it('P2. headings avoid separation from following content (break-after: avoid)', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('h1, h2, h3, h4, h5, h6 {');
    expect(html).toContain('break-after: avoid;');
  });

  it('P3. paragraphs use widow/orphan control', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('p {');
    expect(html).toContain('orphans: 3;');
    expect(html).toContain('widows: 3;');
  });

  it('P4. small messages prefer staying together / message role labels avoid separation', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('.message-role {');
    expect(html).toContain('break-after: avoid;');
  });

  it('P5. very large messages are not globally forced to be unbreakable (break-inside: auto)', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('.message {');
    expect(html).toContain('break-inside: auto;');
  });

  it('P6. code block header avoids separation (break-after: avoid)', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('.code-header {');
    expect(html).toContain('break-after: avoid;');
  });

  it('P7. large code blocks remain splittable (break-inside: auto)', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('.code-wrapper {');
    expect(html).toContain('break-inside: auto;');
  });

  it('P8. table headers are configured for print repetition (display: table-header-group)', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('thead {');
    expect(html).toContain('display: table-header-group;');
  });

  it('P9. large tables remain splittable (break-inside: auto)', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('.table-wrapper {');
    expect(html).toContain('break-inside: auto;');
  });

  it('P10. images remain together (break-inside: avoid)', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('.image-wrapper {');
    expect(html).toContain('break-inside: avoid;');
  });

  it('P11. math blocks remain together (break-inside: avoid)', () => {
    const html = renderConversation(testConv);
    expect(html).toContain('.math-block {');
    expect(html).toContain('break-inside: avoid;');
  });

  it('P12. A4 pagination CSS exists', () => {
    const html = renderConversation(testConv, { pageSize: 'A4' });
    expect(html).toContain('@page {');
    expect(html).toContain('size: 210mm 297mm;');
  });

  it('P13. Letter pagination CSS remains supported', () => {
    const html = renderConversation(testConv, { pageSize: 'LETTER' });
    expect(html).toContain('@page {');
    expect(html).toContain('size: 8.5in 11in;');
  });

  it('P14. portrait remains supported', () => {
    const html = renderConversation(testConv, { pageSize: 'A4', orientation: 'portrait' });
    expect(html).toContain('size: 210mm 297mm;');
  });

  it('P15. landscape remains supported', () => {
    const html = renderConversation(testConv, { pageSize: 'A4', orientation: 'landscape' });
    expect(html).toContain('size: 297mm 210mm;');
  });

  it('P16. dynamic margins remain reflected in @page', () => {
    const html = renderConversation(testConv, { marginTop: '22mm', marginBottom: '18mm' });
    expect(html).toContain('margin-top: 22mm;');
    expect(html).toContain('margin-bottom: 18mm;');
  });

  it('P17. footer/page number behavior remains intact', () => {
    const html = renderConversation(testConv, { showFooterPageNumbers: true });
    expect(html).toContain('.document-footer {');
    expect(html).toContain('break-inside: avoid;');
    expect(html).toContain('content: counter(page);');
  });
});
