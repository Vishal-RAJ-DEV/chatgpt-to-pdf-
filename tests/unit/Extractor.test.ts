import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  extractConversation,
  extractConversationWithResult,
  extractConversationWithResultAsync,
  normalizeText,
  getDeterministicMessageId,
  extractCleanText,
  ExtractionError,
} from '../../src/core/conversation/Extractor';

function loadFixture(filename: string): Document {
  const filePath = resolve(__dirname, '../fixtures/html', filename);
  const html = readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('Extractor Helper Functions', () => {
  it('normalizeText trims outer leading/trailing newlines and collapses 3+ newlines down to 2', () => {
    const raw = 'Hello \r\n\r\n\r\n\r\nWorld!';
    expect(normalizeText(raw)).toBe('Hello\n\nWorld!');
  });

  it('normalizeText preserves single newlines and leading indentation', () => {
    const multiline = 'Line 1\n  Line 2 indented';
    expect(normalizeText(multiline)).toBe('Line 1\n  Line 2 indented');
  });

  it('getDeterministicMessageId uses data-message-id, data-testid, or index fallback', () => {
    const el1 = document.createElement('div');
    el1.setAttribute('data-message-id', 'msg-123');
    expect(getDeterministicMessageId(el1, 0)).toBe('msg-123');

    const el2 = document.createElement('div');
    el2.setAttribute('data-testid', 'conversation-turn-5');
    expect(getDeterministicMessageId(el2, 4)).toBe('conversation-turn-5');

    const el3 = document.createElement('div');
    expect(getDeterministicMessageId(el3, 2)).toBe('turn-3');
  });

  it('extractCleanText strips button elements and copy UI controls', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <p>Here is some text</p>
      <div class="code-header">
        <span>python</span>
        <button class="copy-code-button">Copy code</button>
      </div>
    `;
    const clean = extractCleanText(container);
    expect(clean).toContain('Here is some text');
    expect(clean).not.toContain('Copy code');
  });
});

describe('extractConversation on Basic Fixture', () => {
  const doc = loadFixture('chatgpt-current-basic.html');

  it('extracts complete conversation with correct metadata', () => {
    const conversation = extractConversation(doc, '/c/672a1b9e-4c80-8005-9f5b-123456789abc');

    expect(conversation.id).toBe('672a1b9e-4c80-8005-9f5b-123456789abc');
    expect(conversation.title).toBe('Basic ChatGPT Conversation');
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.metadata?.confidence).toBe('high');
  });

  it('preserves message ordering and author roles', () => {
    const conversation = extractConversation(doc, '/c/672a1b9e-4c80-8005-9f5b-123456789abc');

    const msg1 = conversation.messages[0];
    const msg2 = conversation.messages[1];

    expect(msg1.role).toBe('user');
    expect(msg1.id).toBe('conversation-turn-1');
    expect(msg1.blocks[0].type).toBe('paragraph');

    expect(msg2.role).toBe('assistant');
    expect(msg2.id).toBe('conversation-turn-2');
    expect(msg2.blocks[0].type).toBe('paragraph');
  });
});

describe('extractConversation UI Text Leaks Prevention', () => {
  const doc = loadFixture('chatgpt-current-code.html');

  it('does not leak "Copy code" button text into assistant paragraph block', () => {
    const conversation = extractConversation(doc, '/c/test');
    const assistantMsg = conversation.messages[1];
    const blockText = (assistantMsg.blocks[0] as { text?: string }).text || (assistantMsg.blocks[0] as { code?: string }).code;

    expect(blockText).not.toContain('Copy code');
  });
});

describe('Streaming Protection', () => {
  it('throws ExtractionError with code STREAMING_IN_PROGRESS when active streaming is detected', () => {
    const doc = loadFixture('chatgpt-current-basic.html');
    const assistantTurn = doc.querySelector('[data-message-author-role="assistant"]');
    assistantTurn?.classList.add('result-streaming');

    expect(() => extractConversation(doc, '/c/test')).toThrowError(ExtractionError);
    try {
      extractConversation(doc, '/c/test');
    } catch (err) {
      const extErr = err as ExtractionError;
      expect(extErr.code).toBe('STREAMING_IN_PROGRESS');
      expect(extErr.message).toContain('currently generating');
    }
  });
});

describe('Empty & Unknown Role Message Handling', () => {
  it('handles empty content root by producing blocks: [] without crashing', () => {
    const doc = loadFixture('chatgpt-current-basic.html');
    doc.querySelectorAll('.user-message-content, .markdown').forEach((el) => (el.innerHTML = ''));

    const conversation = extractConversation(doc, '/c/test');
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0].blocks).toHaveLength(0);
    expect(conversation.messages[1].blocks).toHaveLength(0);
  });

  it('preserves unknown role turns as role: "unknown"', () => {
    const doc = loadFixture('chatgpt-current-basic.html');
    const userTurn = doc.querySelector('[data-message-author-role="user"]');
    if (userTurn) {
      userTurn.setAttribute('data-message-author-role', 'custom_unknown_role');
    }

    const conversation = extractConversation(doc, '/c/test');
    expect(conversation.messages[0].role).toBe('unknown');
    expect(conversation.metadata?.confidence).toBe('medium');
  });
});

describe('Phase 9 Empty State Policies & Evidence Requirements', () => {
  it('identifies legitimate empty conversation when positive evidence (URL pathname ID) is present', () => {
    const doc = document.implementation.createHTMLDocument('ChatGPT');
    const container = doc.createElement('div');
    container.setAttribute('data-testid', 'conversation-turns-container');
    doc.body.appendChild(container);

    const result = extractConversationWithResult(doc, '/c/672a1b9e-4c80-8005-9f5b-123456789abc');

    expect(result.status).toBe('empty');
    expect(result.conversation).not.toBeNull();
    expect(result.conversation?.id).toBe('672a1b9e-4c80-8005-9f5b-123456789abc');
    expect(result.conversation?.messages).toHaveLength(0);
  });

  it('treats 0 turns without positive evidence as suspicious_empty', () => {
    const doc = document.implementation.createHTMLDocument('ChatGPT');
    const container = doc.createElement('div');
    container.setAttribute('data-testid', 'conversation-turns-container');
    doc.body.appendChild(container);

    const result = extractConversationWithResult(doc, '/');

    expect(result.status).toBe('suspicious_empty');
    expect(result.conversation).toBeNull();
    expect(result.warnings.some((w: any) => w.code === 'EXTRACTION_EMPTY_SUSPICIOUS')).toBe(true);
  });
});

describe('Phase 9 Long Conversation Recovery Semantics', () => {
  it('verified complete long extraction clears superseded partial warnings and returns status success', async () => {
    const doc = loadFixture('chatgpt-current-basic.html');
    const result = await extractConversationWithResultAsync(doc, '/c/672a1b9e-4c80-8005-9f5b-123456789abc');
    expect(result.status).toBe('success');
    expect(result.warnings).toEqual([]);
  });
});
