import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { checkHealth } from '../../src/adapters/chatgpt/healthCheck';
import { extractConversation } from '../../src/core/conversation/Extractor';
import { isConversation } from '../../src/core/conversation/Model';

function loadFixture(filename: string): Document {
  const filePath = resolve(__dirname, '../fixtures/html', filename);
  const html = readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('Adapter -> Extractor -> Conversation Integration Pipeline', () => {
  it('runs health check and extracts valid Conversation model from basic fixture', () => {
    const doc = loadFixture('chatgpt-current-basic.html');

    // 1. Adapter Health Check
    const health = checkHealth(doc);
    expect(health.supportedHost).toBe(true);
    expect(health.documentReady).toBe(true);
    expect(health.conversationDetected).toBe(true);
    expect(health.confidence).toBe('high');

    // 2. Extractor pipeline
    const conversation = extractConversation(doc, '/c/672a1b9e-4c80-8005-9f5b-123456789abc');

    // 3. Domain Model Type Guard Validation
    expect(isConversation(conversation)).toBe(true);
    expect(conversation.id).toBe('672a1b9e-4c80-8005-9f5b-123456789abc');
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0].role).toBe('user');
    expect(conversation.messages[1].role).toBe('assistant');
  });

  it('extracts rich content fixture preserving turn order and text content', () => {
    const doc = loadFixture('chatgpt-current-rich-content.html');

    const conversation = extractConversation(doc, '/c/rich-test');

    expect(isConversation(conversation)).toBe(true);
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0].blocks[0].type).toBe('paragraph');
    expect(conversation.messages[1].blocks[0].type).toBe('paragraph');
  });
});
