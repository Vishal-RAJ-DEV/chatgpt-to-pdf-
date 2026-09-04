/**
 * Unit Tests — ConversationScroller Adapter (Phase 7).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { ConversationScroller } from '../../src/adapters/chatgpt/ConversationScroller';

describe('ConversationScroller Unit Tests', () => {
  let scroller: ConversationScroller;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    scroller = new ConversationScroller();

    mockContainer = document.createElement('div');
    mockContainer.setAttribute('data-testid', 'conversation-turns-container');
    Object.defineProperty(mockContainer, 'scrollHeight', { value: 2000, writable: true });
    Object.defineProperty(mockContainer, 'clientHeight', { value: 600, writable: true });
    mockContainer.scrollTop = 500;

    document.body.appendChild(mockContainer);
  });

  it('1. locates scroll container using testid attribute', () => {
    const container = scroller.findScrollContainer(document);
    expect(container).not.toBeNull();
  });

  it('2. captures and restores scroll position accurately', () => {
    mockContainer.scrollTop = 450;
    const captured = scroller.captureScrollPosition(mockContainer);

    expect(captured).not.toBeNull();
    expect(captured?.scrollTop).toBe(450);

    mockContainer.scrollTop = 0;
    const restored = scroller.restoreScrollPosition(captured);

    expect(restored).toBe(true);
    expect(mockContainer.scrollTop).toBe(450);
  });

  it('3. scrollByPx modifies scrollTop correctly', () => {
    mockContainer.scrollTop = 500;
    scroller.scrollByPx(mockContainer, -200);
    expect(mockContainer.scrollTop).toBe(300);
  });

  it('4. scrollToTop and scrollToBottom adjust scrollTop to boundaries', () => {
    scroller.scrollToTop(mockContainer);
    expect(mockContainer.scrollTop).toBe(0);
    expect(scroller.isAtTop(mockContainer)).toBe(true);

    scroller.scrollToBottom(mockContainer);
    expect(mockContainer.scrollTop).toBe(2000);
  });

  it('5. waitForDomMutation resolves when timer fires or observer triggers', async () => {
    const promise = scroller.waitForDomMutation(mockContainer, 50);
    await expect(promise).resolves.toBeUndefined();
  });
});
