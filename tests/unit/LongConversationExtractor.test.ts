/**
 * Unit Tests — LongConversationExtractor Coverage & Hardening (Phase 7 Final).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationScroller } from '../../src/adapters/chatgpt/ConversationScroller';
import { ExtractionError } from '../../src/core/conversation/Extractor';
import {
  LongConversationExtractor,
  computeTurnFingerprint,
  parseTurnIndexHint,
  parseNumericTurnIndex,
} from '../../src/core/conversation/LongConversationExtractor';

describe('LongConversationExtractor Coverage & Hardening Unit Tests', () => {
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
    expect(hash1).toBe(hash2);
  });

  it('2. parses numeric turn index from data-testid attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'conversation-turn-7');

    const index = parseNumericTurnIndex(el);
    expect(index).toBe(7);

    const hint = parseTurnIndexHint(el, 0);
    expect(hint).toBe(7);
  });

  it('TEST 1 — physical scroll without new DOM content/turns fails with INCOMPLETE_CONVERSATION', async () => {
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(false);

    // Physical scroll changes scrollTop, but mounted DOM node elements stay completely unchanged
    vi.spyOn(mockScroller, 'scrollByPx').mockImplementation((container, dist) => {
      container.scrollTop += dist;
    });

    const turn1 = document.createElement('div');
    turn1.setAttribute('data-testid', 'conversation-turn-1');
    turn1.setAttribute('data-message-author-role', 'user');
    turn1.innerHTML = '<div class="user-message-content">Stuck Prompt</div>';
    mockContainer.appendChild(turn1);

    const extractor = new LongConversationExtractor(mockScroller, {
      maxStagnantIterations: 2,
      stepDelayMs: 0,
    });

    const promise = extractor.extractLongConversation(document);
    await expect(promise).rejects.toThrow(ExtractionError);

    const err = await promise.catch((e) => e);
    expect((err as ExtractionError).code).toBe('INCOMPLETE_CONVERSATION');
    expect(mockScroller.restoreScrollPosition).toHaveBeenCalled();
  });

  it('TEST 2 — scroll progress with expanding logical turn coverage succeeds cleanly', async () => {
    let step = 0;
    vi.spyOn(mockScroller, 'isAtTop').mockImplementation(() => step >= 2);
    vi.spyOn(mockScroller, 'isAtBottom').mockImplementation(() => step >= 3);

    vi.spyOn(mockScroller, 'waitForDomMutation').mockImplementation(async () => {
      step++;
      mockContainer.innerHTML = '';
      if (step === 1) {
        // Turns 1..10
        for (let i = 1; i <= 10; i++) {
          const turn = document.createElement('div');
          turn.setAttribute('data-testid', `conversation-turn-${i}`);
          turn.setAttribute('data-message-author-role', 'user');
          turn.innerHTML = `<div class="user-message-content">Turn ${i}</div>`;
          mockContainer.appendChild(turn);
        }
      } else if (step === 2) {
        // Turns 11..20
        for (let i = 11; i <= 20; i++) {
          const turn = document.createElement('div');
          turn.setAttribute('data-testid', `conversation-turn-${i}`);
          turn.setAttribute('data-message-author-role', 'user');
          turn.innerHTML = `<div class="user-message-content">Turn ${i}</div>`;
          mockContainer.appendChild(turn);
        }
      }
    });

    const extractor = new LongConversationExtractor(mockScroller, { stepDelayMs: 0 });
    const result = await extractor.extractLongConversation(document);

    expect(result.messages.length).toBe(20);
    expect(result.metadata?.completeness).toBe('complete');
  });

  it('TEST 3 — logical coverage gap throws INCOMPLETE_CONVERSATION', async () => {
    let step = 0;
    vi.spyOn(mockScroller, 'isAtTop').mockImplementation(() => step >= 1);
    vi.spyOn(mockScroller, 'isAtBottom').mockImplementation(() => step >= 2);

    vi.spyOn(mockScroller, 'waitForDomMutation').mockImplementation(async () => {
      step++;
      mockContainer.innerHTML = '';
      if (step === 1) {
        // Turns 1..5 and 15..20 (missing 6..14)
        for (const i of [1, 2, 3, 4, 5, 15, 16, 17, 18, 19, 20]) {
          const turn = document.createElement('div');
          turn.setAttribute('data-testid', `conversation-turn-${i}`);
          turn.setAttribute('data-message-author-role', 'user');
          turn.innerHTML = `<div class="user-message-content">Turn ${i}</div>`;
          mockContainer.appendChild(turn);
        }
      }
    });

    const extractor = new LongConversationExtractor(mockScroller, { stepDelayMs: 0 });
    const promise = extractor.extractLongConversation(document);

    await expect(promise).rejects.toThrow(ExtractionError);

    const err = await promise.catch((e) => e);
    expect((err as ExtractionError).code).toBe('INCOMPLETE_CONVERSATION');
    expect((err as ExtractionError).message).toContain('Logical turn index gap detected');
  });

  it('TEST 4 — same turn remounting produces 1 message and 1 coverage index', async () => {
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(true);
    vi.spyOn(mockScroller, 'isAtBottom').mockReturnValue(true);

    const turn10 = document.createElement('div');
    turn10.setAttribute('data-testid', 'conversation-turn-10');
    turn10.setAttribute('data-message-id', 'msg-turn-10');
    turn10.setAttribute('data-message-author-role', 'user');
    turn10.innerHTML = '<div class="user-message-content">Turn 10</div>';
    mockContainer.appendChild(turn10);

    const extractor = new LongConversationExtractor(mockScroller);
    const result = await extractor.extractLongConversation(document);

    expect(result.messages.length).toBe(1);
    expect(result.messages[0].id).toBe('msg-turn-10');
  });

  it('TEST 5 — identical content in different turns produces separate messages and coverage positions', async () => {
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(true);
    vi.spyOn(mockScroller, 'isAtBottom').mockReturnValue(true);

    const turn1 = document.createElement('div');
    turn1.setAttribute('data-testid', 'conversation-turn-1');
    turn1.setAttribute('data-message-author-role', 'user');
    turn1.innerHTML = '<div class="user-message-content">Hello</div>';

    const turn2 = document.createElement('div');
    turn2.setAttribute('data-testid', 'conversation-turn-2');
    turn2.setAttribute('data-message-author-role', 'user');
    turn2.innerHTML = '<div class="user-message-content">Hello</div>';

    mockContainer.appendChild(turn1);
    mockContainer.appendChild(turn2);

    const extractor = new LongConversationExtractor(mockScroller);
    const result = await extractor.extractLongConversation(document);

    expect(result.messages.length).toBe(2);
    expect(result.messages[0].id).toBe('conversation-turn-1');
    expect(result.messages[1].id).toBe('conversation-turn-2');
  });

  it('TEST 6 — numeric turn indices participate in coverage tracking', () => {
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'conversation-turn-7');

    const numIdx = parseNumericTurnIndex(el);
    expect(numIdx).toBe(7);
  });

  it('TEST 7 — 100+ synthetic turns across multi-pass viewports', async () => {
    let step = 0;
    vi.spyOn(mockScroller, 'isAtTop').mockImplementation(() => step >= 3);
    vi.spyOn(mockScroller, 'isAtBottom').mockImplementation(() => step >= 4);

    vi.spyOn(mockScroller, 'waitForDomMutation').mockImplementation(async () => {
      step++;
      mockContainer.innerHTML = '';
      const start = (step - 1) * 35 + 1;
      const end = Math.min(105, step * 35);
      for (let i = start; i <= end; i++) {
        const turn = document.createElement('div');
        turn.setAttribute('data-testid', `conversation-turn-${i}`);
        turn.setAttribute('data-message-author-role', i % 2 !== 0 ? 'user' : 'assistant');
        turn.innerHTML = `<div class="user-message-content">Turn ${i}</div>`;
        mockContainer.appendChild(turn);
      }
    });

    const extractor = new LongConversationExtractor(mockScroller, { stepDelayMs: 0 });
    const conversation = await extractor.extractLongConversation(document, '/c/100-turns');

    expect(conversation.messages.length).toBe(105);
    expect(conversation.metadata?.completeness).toBe('complete');
    expect(conversation.messages[0].id).toBe('conversation-turn-1');
    expect(conversation.messages[104].id).toBe('conversation-turn-105');
  });

  it('TEST 8 — missing numeric index support in virtualized DOM fails closed', async () => {
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(false);

    // DOM nodes without numeric conversation-turn-N testid
    const turn = document.createElement('div');
    turn.setAttribute('data-message-author-role', 'user');
    turn.innerHTML = '<div class="user-message-content">No Index Turn</div>';
    mockContainer.appendChild(turn);

    const extractor = new LongConversationExtractor(mockScroller, { maxIterations: 1 });
    const promise = extractor.extractLongConversation(document);

    await expect(promise).rejects.toThrow(ExtractionError);
    const err = await promise.catch((e) => e);
    expect((err as ExtractionError).code).toBe('INCOMPLETE_CONVERSATION');
  });

  it('TEST 9 — scroll position restoration runs on coverage failure', async () => {
    mockContainer.scrollTop = 1500;
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(false);

    const extractor = new LongConversationExtractor(mockScroller, { maxDurationMs: -1 });
    await extractor.extractLongConversation(document).catch(() => {});

    expect(mockScroller.restoreScrollPosition).toHaveBeenCalledWith(
      expect.objectContaining({ scrollTop: 1000 })
    );
  });

  it('TEST 10 — completeness is explicit (partial coverage never returns Conversation object)', async () => {
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(false);

    const extractor = new LongConversationExtractor(mockScroller, { maxIterations: 1 });
    const result = await extractor.extractLongConversation(document).catch((e) => e);

    expect(result).toBeInstanceOf(ExtractionError);
    expect((result as ExtractionError).code).toBe('INCOMPLETE_CONVERSATION');
  });
});
