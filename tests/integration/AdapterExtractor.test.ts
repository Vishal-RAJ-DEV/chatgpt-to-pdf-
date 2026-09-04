import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { checkHealth } from '../../src/adapters/chatgpt/healthCheck';
import { extractConversation } from '../../src/core/conversation/Extractor';
import { isConversation } from '../../src/core/conversation/Model';
import {
  HeadingBlock,
  ListBlock,
  CodeBlock,
  TableBlock,
  QuoteBlock,
  MathBlock,
} from '../../src/core/conversation/Model';

function loadFixture(filename: string): Document {
  const filePath = resolve(__dirname, '../fixtures/html', filename);
  const html = readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('Adapter -> Rich Content Extractor -> Conversation Integration Pipeline', () => {
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

  it('extracts rich content combined fixture preserving block sequence and types', () => {
    const doc = loadFixture('chatgpt-rich-combined.html');

    const conversation = extractConversation(doc, '/c/rich-test');

    expect(isConversation(conversation)).toBe(true);
    expect(conversation.messages).toHaveLength(2);

    const assistantMsg = conversation.messages[1];
    expect(assistantMsg.role).toBe('assistant');

    const blockTypes = assistantMsg.blocks.map((b) => b.type);
    expect(blockTypes).toEqual([
      'heading',
      'paragraph',
      'list',
      'code',
      'table',
      'quote',
      'paragraph',
      'math',
      'paragraph',
    ]);

    // Inspect individual rich blocks
    const heading = assistantMsg.blocks[0] as HeadingBlock;
    expect(heading.text).toBe('Overview Guide');

    const list = assistantMsg.blocks[2] as ListBlock;
    expect(list.items[0].children?.[0].text).toBe('Sub-feature item 1.1');

    const code = assistantMsg.blocks[3] as CodeBlock;
    expect(code.language).toBe('python');
    expect(code.code).toContain('def calculate_sum(a, b):');

    const table = assistantMsg.blocks[4] as TableBlock;
    expect(table.headers).toEqual(['Language', 'Speed', 'Type']);

    const quote = assistantMsg.blocks[5] as QuoteBlock;
    expect(quote.text).toContain('Dijkstra');

    const math = assistantMsg.blocks[7] as MathBlock;
    expect(math.expression).toBe('E = mc^2');
  });
});
