/**
 * Unit Tests — LongConversationExtractor (Phase 7 Hardening).
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
  let mockContainer: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';

    mockContainer = document.createElement('div');
    mockContainer.setAttribute('data-testid', 'conversation-turns-container');
    Object.defineProperty(mockContainer, 'scrollHeight', { value: 3000, writable: true });
    Object.defineProperty(mockContainer, 'clientHeight', { value: 600, writable: true });
    mockContainer.scrollTop = 1000;
    document.body.appendChild(mockContainer);

    mockScroller = {
      findScrollContainer: vi.fn().mockReturnValue(mockContainer),
      captureScrollPosition: vi.fn().mockReturnValue({ container: mockContainer, scrollTop: 1000 }),
      restoreScrollPosition: vi.fn().mockReturnValue(true),
      scrollByPx: vi.fn(),
      scrollToTop: vi.fn(),
      scrollToBottom: vi.fn(),
      isAtTop: vi.fn().mockReturnValue(false),
      isAtBottom: vi.fn().mockReturnValue(false),
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
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(true);
    vi.spyOn(mockScroller, 'isAtBottom').mockReturnValue(true);
    Object.defineProperty(mockContainer, 'scrollHeight', { value: 500, writable: true });

    const turn1 = document.createElement('div');
    turn1.setAttribute('data-testid', 'conversation-turn-1');
    turn1.setAttribute('data-message-author-role', 'user');
    turn1.innerHTML = '<div class="user-message-content">Hello</div>';

    const turn2 = document.createElement('div');
    turn2.setAttribute('data-testid', 'conversation-turn-2');
    turn2.setAttribute('data-message-author-role', 'assistant');
    turn2.innerHTML = '<div class="markdown prose">Hi there</div>';

    mockContainer.appendChild(turn1);
    mockContainer.appendChild(turn2);

    const extractor = new LongConversationExtractor(mockScroller);
    const result = await extractor.extractLongConversation(document, '/c/test-123');

    expect(result.messages.length).toBe(2);
    expect(result.metadata?.completeness).toBe('complete');
    expect(mockScroller.restoreScrollPosition).toHaveBeenCalled();
  });

  it('4. throws ExtractionError STREAMING_IN_PROGRESS when active streaming is detected', async () => {
    const streamingEl = document.createElement('div');
    streamingEl.className = 'result-streaming';
    document.body.appendChild(streamingEl);

    const extractor = new LongConversationExtractor(mockScroller);
    await expect(extractor.extractLongConversation(document)).rejects.toThrow(ExtractionError);
  });

  it('5. throws LONG_CONVERSATION_TIMEOUT when maxDurationMs is reached during scroll-up', async () => {
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(false);

    const extractor = new LongConversationExtractor(mockScroller, {
      maxDurationMs: -1, // Expired immediately
      stepDelayMs: 0,
    });

    const promise = extractor.extractLongConversation(document);
    await expect(promise).rejects.toThrow(ExtractionError);

    const err = await promise.catch((e) => e);
    expect((err as ExtractionError).code).toBe('LONG_CONVERSATION_TIMEOUT');
    expect(mockScroller.restoreScrollPosition).toHaveBeenCalled();
  });

  it('6. throws LONG_CONVERSATION_TIMEOUT when maxDurationMs is reached during scroll-down', async () => {
    let callCount = 0;
    vi.spyOn(mockScroller, 'isAtTop').mockImplementation(() => {
      callCount++;
      return callCount > 1; // Top reached on second call
    });
    vi.spyOn(mockScroller, 'isAtBottom').mockReturnValue(false);

    // Make Date.now() expire during Phase B
    const realNow = Date.now;
    let nowCall = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      nowCall++;
      return nowCall > 3 ? realNow() + 100000 : realNow();
    });

    const extractor = new LongConversationExtractor(mockScroller, {
      maxDurationMs: 1000,
      stepDelayMs: 0,
    });

    const promise = extractor.extractLongConversation(document);
    await expect(promise).rejects.toThrow(ExtractionError);

    const err = await promise.catch((e) => e);
    expect((err as ExtractionError).code).toBe('LONG_CONVERSATION_TIMEOUT');

    vi.restoreAllMocks();
  });

  it('7. throws INCOMPLETE_CONVERSATION when maxIterations is reached before completing traversal', async () => {
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(false);

    const extractor = new LongConversationExtractor(mockScroller, {
      maxIterations: 2,
      stepDelayMs: 0,
    });

    const promise = extractor.extractLongConversation(document);
    await expect(promise).rejects.toThrow(ExtractionError);

    const err = await promise.catch((e) => e);
    expect((err as ExtractionError).code).toBe('INCOMPLETE_CONVERSATION');
    expect(mockScroller.restoreScrollPosition).toHaveBeenCalled();
  });

  it('8. partial collection NEVER produces a conversation model with completeness = "complete"', async () => {
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(false);

    const turn1 = document.createElement('div');
    turn1.setAttribute('data-testid', 'conversation-turn-1');
    turn1.setAttribute('data-message-author-role', 'user');
    turn1.innerHTML = '<div class="user-message-content">Partial Prompt</div>';
    mockContainer.appendChild(turn1);

    const extractor = new LongConversationExtractor(mockScroller, { maxIterations: 1 });
    const result = await extractor.extractLongConversation(document).catch((e) => e);

    // Must be an ExtractionError, not a Conversation object marked 'complete'
    expect(result).toBeInstanceOf(ExtractionError);
    expect((result as ExtractionError).code).toBe('INCOMPLETE_CONVERSATION');
  });

  it('9. deduplicates repeated turns during traversal', async () => {
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(true);
    vi.spyOn(mockScroller, 'isAtBottom').mockReturnValue(true);

    const turn1 = document.createElement('div');
    turn1.setAttribute('data-testid', 'conversation-turn-1');
    turn1.setAttribute('data-message-id', 'msg-100');
    turn1.setAttribute('data-message-author-role', 'user');
    turn1.innerHTML = '<div class="user-message-content">First Prompt</div>';

    mockContainer.appendChild(turn1);

    const extractor = new LongConversationExtractor(mockScroller);
    const result = await extractor.extractLongConversation(document);

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].id).toBe('msg-100');
    expect(result.metadata?.completeness).toBe('complete');
  });
});
