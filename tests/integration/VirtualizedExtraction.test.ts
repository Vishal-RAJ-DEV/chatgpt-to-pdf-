/**
 * Integration Tests — Virtualized Conversation Extraction (Phase 7 Hardening).
 *
 * Verifies end-to-end traversal, turn deduplication, order reconstruction,
 * scroll restoration, and safety limit enforcement on virtualized DOM containers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationScroller } from '../../src/adapters/chatgpt/ConversationScroller';
import { ExtractionError } from '../../src/core/conversation/Extractor';
import { LongConversationExtractor } from '../../src/core/conversation/LongConversationExtractor';

describe('Virtualized Conversation Extraction Integration Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('1. extracts 50+ synthetic turns in correct chronological sequence', async () => {
    const container = document.createElement('div');
    container.setAttribute('data-testid', 'conversation-turns-container');

    for (let i = 1; i <= 50; i++) {
      const isUser = i % 2 !== 0;
      const turn = document.createElement('div');
      turn.setAttribute('data-testid', `conversation-turn-${i}`);
      turn.setAttribute('data-message-id', `msg-id-${i}`);
      turn.setAttribute('data-message-author-role', isUser ? 'user' : 'assistant');

      if (isUser) {
        turn.innerHTML = `<div class="user-message-content">User question number ${i}</div>`;
      } else {
        turn.innerHTML = `<div class="markdown prose"><p>Assistant answer number ${i}</p></div>`;
      }
      container.appendChild(turn);
    }

    document.body.appendChild(container);

    const scroller = new ConversationScroller();
    const extractor = new LongConversationExtractor(scroller);

    const conversation = await extractor.extractLongConversation(document, '/c/50-turns-chat');

    expect(conversation.messages.length).toBe(50);
    expect(conversation.metadata?.completeness).toBe('complete');
    expect(conversation.messages[0].id).toBe('msg-id-1');
    expect(conversation.messages[49].id).toBe('msg-id-50');
  });

  it('2. handles virtualized DOM where turns unmount/remount during scroll steps without duplicating', async () => {
    const container = document.createElement('div');
    container.setAttribute('data-testid', 'conversation-turns-container');
    document.body.appendChild(container);

    // Initial state: only turns 1..5 mounted
    for (let i = 1; i <= 5; i++) {
      const turn = document.createElement('div');
      turn.setAttribute('data-testid', `conversation-turn-${i}`);
      turn.setAttribute('data-message-id', `msg-id-${i}`);
      turn.setAttribute('data-message-author-role', i % 2 !== 0 ? 'user' : 'assistant');
      turn.innerHTML = `<div class="user-message-content">Message ${i}</div>`;
      container.appendChild(turn);
    }

    // Mock scroller to simulate unmounting 1..5 and mounting 6..10 on scroll step
    const mockScroller = new ConversationScroller();
    let stepCount = 0;

    vi.spyOn(mockScroller, 'isAtTop').mockImplementation(() => stepCount >= 1);
    vi.spyOn(mockScroller, 'isAtBottom').mockImplementation(() => stepCount >= 2);

    vi.spyOn(mockScroller, 'waitForDomMutation').mockImplementation(async () => {
      stepCount++;
      if (stepCount === 1) {
        // Replace 1..5 with 6..10 in DOM
        container.innerHTML = '';
        for (let i = 6; i <= 10; i++) {
          const turn = document.createElement('div');
          turn.setAttribute('data-testid', `conversation-turn-${i}`);
          turn.setAttribute('data-message-id', `msg-id-${i}`);
          turn.setAttribute('data-message-author-role', i % 2 !== 0 ? 'user' : 'assistant');
          turn.innerHTML = `<div class="user-message-content">Message ${i}</div>`;
          container.appendChild(turn);
        }
      }
    });

    const extractor = new LongConversationExtractor(mockScroller, { stepDelayMs: 10 });
    const conversation = await extractor.extractLongConversation(document, '/c/virtualized-chat');

    expect(conversation.messages.length).toBe(10);
    expect(conversation.metadata?.completeness).toBe('complete');
    expect(conversation.messages.map((m) => m.id)).toEqual([
      'msg-id-1',
      'msg-id-2',
      'msg-id-3',
      'msg-id-4',
      'msg-id-5',
      'msg-id-6',
      'msg-id-7',
      'msg-id-8',
      'msg-id-9',
      'msg-id-10',
    ]);
  });

  it('3. rejects partial collection when iteration limit is reached before reaching boundaries', async () => {
    const container = document.createElement('div');
    container.setAttribute('data-testid', 'conversation-turns-container');
    document.body.appendChild(container);

    const turn1 = document.createElement('div');
    turn1.setAttribute('data-testid', 'conversation-turn-1');
    turn1.setAttribute('data-message-id', 'msg-1');
    turn1.setAttribute('data-message-author-role', 'user');
    turn1.innerHTML = '<div class="user-message-content">Initial Prompt</div>';
    container.appendChild(turn1);

    const mockScroller = new ConversationScroller();
    vi.spyOn(mockScroller, 'isAtTop').mockReturnValue(false); // Top never reached

    const extractor = new LongConversationExtractor(mockScroller, {
      maxIterations: 2,
      stepDelayMs: 0,
    });

    const res = await extractor.extractLongConversation(document).catch((e) => e);

    expect(res).toBeInstanceOf(ExtractionError);
    expect((res as ExtractionError).code).toBe('INCOMPLETE_CONVERSATION');
  });
});
