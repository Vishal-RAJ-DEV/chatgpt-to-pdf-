import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  isSupportedHost,
  isDocumentReady,
  findConversationRoot,
  findTurnCandidates,
  getRoleFromElement,
  findContentRoot,
  getConversationTitle,
  getConversationId,
  isStreaming,
} from '../../src/adapters/chatgpt/ChatGPTAdapter';
import { extractConversationWithResult } from '../../src/core/conversation/Extractor';

function loadFixture(filename: string): Document {
  const filePath = resolve(__dirname, '../fixtures/html', filename);
  const html = readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('ChatGPTAdapter Host & Ready Detection', () => {
  it('identifies valid chatgpt.com hostnames', () => {
    expect(isSupportedHost('chatgpt.com')).toBe(true);
    expect(isSupportedHost('www.chatgpt.com')).toBe(true);
    expect(isSupportedHost('other.com')).toBe(false);
  });

  it('identifies readyState complete and interactive', () => {
    expect(isDocumentReady('complete')).toBe(true);
    expect(isDocumentReady('interactive')).toBe(true);
    expect(isDocumentReady('loading')).toBe(false);
  });
});

describe('ChatGPTAdapter DOM Discovery on Basic Fixture', () => {
  const doc = loadFixture('chatgpt-current-basic.html');

  it('finds conversation container', () => {
    const root = findConversationRoot(doc);
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-testid')).toBe('conversation-turns-container');
  });

  it('finds turn candidates', () => {
    const turns = findTurnCandidates(doc);
    expect(turns.length).toBe(2);
  });

  it('detects user and assistant roles correctly', () => {
    const turns = findTurnCandidates(doc);
    expect(getRoleFromElement(turns[0])).toBe('user');
    expect(getRoleFromElement(turns[1])).toBe('assistant');
  });

  it('locates content roots for user and assistant turns', () => {
    const turns = findTurnCandidates(doc);
    const userContent = findContentRoot(turns[0]);
    const assistantContent = findContentRoot(turns[1]);

    expect(userContent).not.toBeNull();
    expect(userContent?.textContent?.trim()).toContain('Hello World in Python');

    expect(assistantContent).not.toBeNull();
    expect(assistantContent?.textContent?.trim()).toContain('write a Hello World program');
  });

  it('extracts title from document.title', () => {
    const title = getConversationTitle(doc);
    expect(title).toBe('Basic ChatGPT Conversation');
  });

  it('extracts conversation ID from URL path', () => {
    const id = getConversationId('/c/672a1b9e-4c80-8005-9f5b-123456789abc');
    expect(id).toBe('672a1b9e-4c80-8005-9f5b-123456789abc');
  });

  it('returns null conversation ID for home path', () => {
    expect(getConversationId('/')).toBeNull();
  });
});

describe('ChatGPTAdapter DOM Discovery on Code Fixture', () => {
  const doc = loadFixture('chatgpt-current-code.html');

  it('finds assistant turn and code element inside markdown prose', () => {
    const turns = findTurnCandidates(doc);
    expect(turns.length).toBe(2);
    const assistantTurn = turns[1];
    const content = findContentRoot(assistantTurn);
    expect(content).not.toBeNull();

    const pre = content?.querySelector('pre');
    const code = content?.querySelector('code');
    expect(pre).not.toBeNull();
    expect(code?.className).toContain('language-python');
    expect(code?.textContent).toContain('def fibonacci');
  });
});

describe('ChatGPTAdapter DOM Discovery on Table Fixture', () => {
  const doc = loadFixture('chatgpt-current-table.html');

  it('locates table element inside assistant turn', () => {
    const turns = findTurnCandidates(doc);
    const assistantTurn = turns[1];
    const content = findContentRoot(assistantTurn);
    const table = content?.querySelector('table');

    expect(table).not.toBeNull();
    expect(table?.querySelectorAll('th').length).toBe(3);
    expect(table?.querySelectorAll('tbody tr').length).toBe(2);
  });
});

describe('ChatGPTAdapter Streaming Detection', () => {
  it('returns false when no streaming class is present', () => {
    const doc = loadFixture('chatgpt-current-basic.html');
    expect(isStreaming(doc)).toBe(false);
  });

  it('returns true when streaming class is present', () => {
    const doc = loadFixture('chatgpt-current-basic.html');
    const assistantTurn = doc.querySelector('[data-message-author-role="assistant"]');
    assistantTurn?.classList.add('result-streaming');
    expect(isStreaming(doc)).toBe(true);
  });
});

describe('ChatGPTAdapter Phase 9 Resilience & Fallback Tests', () => {
  it('rejects generic article.w-full elements without author role or turn testid', () => {
    const doc = document.implementation.createHTMLDocument('test');
    const container = doc.createElement('div');
    container.setAttribute('data-testid', 'conversation-turns-container');
    doc.body.appendChild(container);

    const genericArticle = doc.createElement('article');
    genericArticle.className = 'w-full text-token-text-primary';
    container.appendChild(genericArticle);

    const turns = findTurnCandidates(doc);
    expect(turns.length).toBe(0);
  });

  it('returns null from findContentRoot when content root cannot be identified', () => {
    const doc = document.implementation.createHTMLDocument('test');
    const turnEl = doc.createElement('div');
    turnEl.setAttribute('data-message-author-role', 'assistant');
    const buttonOnly = doc.createElement('button');
    buttonOnly.textContent = 'Copy';
    turnEl.appendChild(buttonOnly);

    const contentRoot = findContentRoot(turnEl);
    expect(contentRoot).toBeNull();
  });
});

describe('Phase 13 Correction #2 — Real ChatGPT DOM Shape (role on child div)', () => {
  /**
   * Regression suite for the real ChatGPT DOM structure where:
   *   - Outer element: article[data-testid="conversation-turn-N"]   (NO role attribute)
   *   - Inner element: div[data-message-author-role="user|assistant"] (role lives HERE)
   *
   * Previously getRoleFromElement only checked the passed element's own attributes,
   * causing all turns to be classified as 'unknown' in the real browser.
   */

  it('1. getRoleFromElement resolves "user" when role attr is on a child element', () => {
    const doc = document.implementation.createHTMLDocument('test');
    const article = doc.createElement('article');
    article.setAttribute('data-testid', 'conversation-turn-1');
    const inner = doc.createElement('div');
    inner.setAttribute('data-message-author-role', 'user');
    inner.innerHTML = '<div class="whitespace-pre-wrap">Hello</div>';
    article.appendChild(inner);

    expect(getRoleFromElement(article)).toBe('user');
  });

  it('2. getRoleFromElement resolves "assistant" when role attr is on a child element', () => {
    const doc = document.implementation.createHTMLDocument('test');
    const article = doc.createElement('article');
    article.setAttribute('data-testid', 'conversation-turn-2');
    const inner = doc.createElement('div');
    inner.setAttribute('data-message-author-role', 'assistant');
    inner.innerHTML = '<div class="markdown prose"><p>Answer</p></div>';
    article.appendChild(inner);

    expect(getRoleFromElement(article)).toBe('assistant');
  });

  it('3. getRoleFromElement still works when role attr is on the element itself (fixture/older DOM)', () => {
    const doc = document.implementation.createHTMLDocument('test');
    const article = doc.createElement('article');
    article.setAttribute('data-testid', 'conversation-turn-1');
    article.setAttribute('data-message-author-role', 'user');
    article.innerHTML = '<div class="user-message-content">Hello</div>';

    expect(getRoleFromElement(article)).toBe('user');
  });

  it('4. getRoleFromElement returns null for auxiliary element with no role anywhere', () => {
    const doc = document.implementation.createHTMLDocument('test');
    const article = doc.createElement('article');
    article.setAttribute('data-testid', 'conversation-turn-3');
    article.innerHTML = '<div class="system-message-banner"><span>ChatGPT can make mistakes.</span></div>';

    expect(getRoleFromElement(article)).toBeNull();
  });

  it('5. full extraction of real-DOM-shape fixture returns status success with correct roles', () => {
    const doc = loadFixture('chatgpt-real-dom-shape.html');
    const turns = findTurnCandidates(doc);

    // Should find all 3 turn articles
    expect(turns.length).toBe(3);

    // Turn 1: role on child div -> must resolve to user
    expect(getRoleFromElement(turns[0])).toBe('user');

    // Turn 2: role on child div -> must resolve to assistant
    expect(getRoleFromElement(turns[1])).toBe('assistant');

    // Turn 3: auxiliary with no role anywhere -> null (unknown)
    expect(getRoleFromElement(turns[2])).toBeNull();
  });

  it('6. extractConversationWithResult on real-DOM-shape fixture returns status success without partial warning', () => {
    const doc = loadFixture('chatgpt-real-dom-shape.html');
    const result = extractConversationWithResult(doc, '/c/test-real-dom');

    expect(result.status).toBe('success');
    expect(result.conversation).not.toBeNull();
    expect(result.counts.user).toBe(1);
    expect(result.counts.assistant).toBe(1);
    // Auxiliary unknown turn (turn 3) must not trigger a partial warning
    expect(result.warnings.some((w) => w.code === 'EXTRACTION_PARTIAL')).toBe(false);
  });
});
