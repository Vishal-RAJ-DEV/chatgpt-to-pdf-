/**
 * Unit Tests — Security Hardening & Malformed Input Resilience (Phase 9).
 */

import { describe, it, expect } from 'vitest';
import {
  renderConversation,
  sanitizeUrl,
} from '../../src/core/renderer/DocumentRenderer';
import { Conversation, ContentBlock } from '../../src/core/conversation/Model';

describe('Security Hardening & XSS Resilience', () => {
  it('1. escapes script tags and malicious HTML in conversation titles and text', () => {
    const maliciousConv: Conversation = {
      id: 'c-xss',
      title: '<script>alert("XSS Title")</script>',
      url: 'https://chatgpt.com/c/c-xss',
      createdAt: '2026-09-04T12:00:00Z',
      messages: [
        {
          id: 'm1',
          role: 'user',
          blocks: [{ type: 'paragraph', text: '<img src=x onerror=alert(1)>' }],
        },
      ],
    };

    const html = renderConversation(maliciousConv, { showConversationTitle: true });

    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert');
    expect(html).toContain('&lt;img src=x');
  });

  it('2. sanitizes javascript:, vbscript:, and data:text/html URLs in links and images', () => {
    expect(sanitizeUrl('javascript:alert(document.cookie)')).toBe('');
    expect(sanitizeUrl('VBSCRIPT:msgbox(1)')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeUrl('https://example.com/safe.png')).toBe('https://example.com/safe.png');
  });

  it('3. safely renders unknown or malformed content blocks without throwing', () => {
    const malformedConv: Conversation = {
      id: 'c-malformed',
      title: 'Malformed Blocks Test',
      url: 'https://chatgpt.com/c/c-malformed',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [
            { type: 'unexpected_type', rawData: '<script>' } as unknown as ContentBlock,
            null as unknown as ContentBlock,
          ],
        },
      ],
    };

    expect(() => renderConversation(malformedConv)).not.toThrow();
    const html = renderConversation(malformedConv);
    expect(html).toContain('class="fallback-block"');
  });

  it('4. escapes HTML special characters inside code blocks and tables', () => {
    const codeConv: Conversation = {
      id: 'c-code',
      title: 'Code XSS',
      url: 'https://chatgpt.com/',
      messages: [
        {
          id: 'm1',
          role: 'assistant',
          blocks: [
            { type: 'code', code: 'const html = "<div>Unescaped</div>";' },
            { type: 'table', headers: ['<Column>'], rows: [['<Cell>']] },
          ],
        },
      ],
    };

    const html = renderConversation(codeConv);
    expect(html).toContain('const html = &quot;&lt;div&gt;Unescaped&lt;/div&gt;&quot;;');
    expect(html).toContain('&lt;Column&gt;');
    expect(html).toContain('&lt;Cell&gt;');
  });
});
