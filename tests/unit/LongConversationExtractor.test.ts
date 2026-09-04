/**
 * Unit Tests — LongConversationExtractor (Phase 7).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationScroller } from '../../src/adapters/chatgpt/ConversationScroller';
import { ExtractionError } from '../../src/core/conversation/Extractor';
import {
  LongConversationExtractor,
  computeTurnFingerprint,
  parseTurnIndexHint,
} from '../../src/core/conversation/LongConversationExtractor';

describe('LongConversationExtractor Unit Tests', () => {
  let mockScroller: ConversationScroller;

  beforeEach(() => {
    document.body.innerHTML = '';

    mockScroller = {
      findScrollContainer: vi.fn().mockReturnValue(null),
      captureScrollPosition: vi.fn().mockReturnValue(null),
      restoreScrollPosition: vi.fn().mockReturnValue(true),
      scrollByPx: vi.fn(),
      scrollToTop: vi.fn(),
      scrollToBottom: vi.fn(),
      isAtTop: vi.fn().mockReturnValue(true),
      isAtBottom: vi.fn().mockReturnValue(true),
      waitForDomMutation: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConversationScroller;
  });

  it('1. computes deterministic turn fingerprint hash', () => {
    const hash1 = computeTurnFingerprint('user', [{ type: 'paragraph', text: 'Hello' }]);
    const hash2 = computeTurnFingerprint('user', [{ type: 'paragraph', text: 'Hello' }]);
    const hash3 = computeTurnFingerprint('assistant', [{ type: 'paragraph', text: 'Hello' }]);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('2. parses turn index hint from data-testid attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'conversation-turn-7');

    const index = parseTurnIndexHint(el, 0);
    expect(index).toBe(7);
  });

  it('3. executes fast-path extraction for non-virtualized short conversation', async () => {
    const container = document.createElement('div');
    container.setAttribute('data-testid', 'conversation-turns-container');

    const turn1 = document.createElement('div');
    turn1.setAttribute('data-testid', 'conversation-turn-1');
    turn1.setAttribute('data-message-author-role', 'user');
    turn1.innerHTML = '<div class="user-message-content">Hello</div>';

    const turn2 = document.createElement('div');
    turn2.setAttribute('data-testid', 'conversation-turn-2');
    turn2.setAttribute('data-message-author-role', 'assistant');
    turn2.innerHTML = '<div class="markdown prose">Hi there</div>';

    container.appendChild(turn1);
    container.appendChild(turn2);
    document.body.appendChild(container);

    const extractor = new LongConversationExtractor(mockScroller);
    const result = await extractor.extractLongConversation(document, '/c/test-123');

    expect(result.messages.length).toBe(2);
    expect(result.metadata?.completeness).toBe('complete');
  });

  it('4. throws ExtractionError STREAMING_IN_PROGRESS when active streaming is detected', async () => {
    const streamingEl = document.createElement('div');
    streamingEl.className = 'result-streaming';
    document.body.appendChild(streamingEl);

    const extractor = new LongConversationExtractor(mockScroller);
    await expect(extractor.extractLongConversation(document)).rejects.toThrow(ExtractionError);
  });

  it('5. deduplicates repeated turns during traversal', async () => {
    const container = document.createElement('div');
    container.setAttribute('data-testid', 'conversation-turns-container');

    const turn1 = document.createElement('div');
    turn1.setAttribute('data-testid', 'conversation-turn-1');
    turn1.setAttribute('data-message-id', 'msg-100');
    turn1.setAttribute('data-message-author-role', 'user');
    turn1.innerHTML = '<div class="user-message-content">First Prompt</div>';

    container.appendChild(turn1);
    document.body.appendChild(container);

    const extractor = new LongConversationExtractor(mockScroller);
    const result = await extractor.extractLongConversation(document);

    // Duplicate ID should result in exactly 1 message
    expect(result.messages.length).toBe(1);
    expect(result.messages[0].id).toBe('msg-100');
  });
});
