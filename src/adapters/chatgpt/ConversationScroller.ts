/**
 * ChatGPT Conversation Scroller — Phase 7.
 *
 * Low-level DOM scroll surface detection, scroll position capture/restoration,
 * incremental scrolling, and MutationObserver observation for virtualized
 * ChatGPT conversation containers.
 */

import { chatGPTSelectors } from './selectors';

export interface ScrollPosition {
  container: HTMLElement;
  scrollTop: number;
}

export class ConversationScroller {
  /**
   * Locates the scroll container for the ChatGPT conversation.
   * Priority:
   *  1. Element matching `chatGPTSelectors.conversationContainer` that has scroll overflow or scroll height > client height
   *  2. Parent element of `[data-testid^="conversation-turn-"]` with overflow scroll/auto
   *  3. `document.documentElement` or `document.body` fallback
   */
  public findScrollContainer(
    root: Document | Element = typeof document !== 'undefined' ? document : (null as unknown as Document)
  ): HTMLElement | null {
    if (!root) return null;

    // Check conversation container selectors
    for (const entry of chatGPTSelectors.conversationContainer) {
      const el = root.querySelector(entry.selector);
      if (el) {
        // If el itself is scrollable or has scroll container parent
        const scrollable = this.findNearestScrollableParent(el);
        if (scrollable) return scrollable;
      }
    }

    // Check parent of turn candidates
    for (const entry of chatGPTSelectors.turn) {
      const turnNode = root.querySelector(entry.selector);
      if (turnNode) {
        const scrollable = this.findNearestScrollableParent(turnNode);
        if (scrollable) return scrollable;
      }
    }

    // Fallback to document element if in browser
    if (typeof document !== 'undefined') {
      return (document.scrollingElement || document.documentElement || document.body) as HTMLElement;
    }

    return null;
  }

  /**
   * Finds the nearest scrollable parent element for a target node.
   */
  private findNearestScrollableParent(node: Element): HTMLElement | null {
    let current: Element | null = node;

    while (current && current !== document.body && current !== document.documentElement) {
      if (current instanceof HTMLElement) {
        const style = typeof window !== 'undefined' ? window.getComputedStyle(current) : null;
        const overflowY = style ? style.overflowY : '';
        const isScrollStyle = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
        const hasScrollHeight = current.scrollHeight > current.clientHeight;

        if (isScrollStyle || (hasScrollHeight && current.clientHeight > 0)) {
          return current;
        }
      }
      current = current.parentElement;
    }

    return current instanceof HTMLElement ? current : null;
  }

  /**
   * Captures the current scroll position of the conversation scroll container.
   */
  public captureScrollPosition(container: HTMLElement | null): ScrollPosition | null {
    if (!container) return null;
    return {
      container,
      scrollTop: container.scrollTop,
    };
  }

  /**
   * Restores a previously captured scroll position safely.
   */
  public restoreScrollPosition(position: ScrollPosition | null): boolean {
    if (!position || !position.container) return false;
    try {
      position.container.scrollTop = position.scrollTop;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Scrolls the container incrementally by `distancePx` (negative to scroll up towards top).
   */
  public scrollByPx(container: HTMLElement, distancePx: number): void {
    if (!container) return;
    container.scrollTop = container.scrollTop + distancePx;
  }

  /**
   * Scrolls container to top (scrollTop = 0).
   */
  public scrollToTop(container: HTMLElement): void {
    if (!container) return;
    container.scrollTop = 0;
  }

  /**
   * Scrolls container to bottom (scrollTop = scrollHeight).
   */
  public scrollToBottom(container: HTMLElement): void {
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Checks if the scroll position is at the very top of the container.
   */
  public isAtTop(container: HTMLElement): boolean {
    if (!container) return true;
    return container.scrollTop <= 5;
  }

  /**
   * Checks if the scroll position is at the bottom of the container.
   */
  public isAtBottom(container: HTMLElement): boolean {
    if (!container) return true;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceToBottom <= 10;
  }

  /**
   * Observes DOM mutations on `target` element for up to `timeoutMs`.
   * Resolves immediately when child nodes are added/removed or content changes.
   */
  public waitForDomMutation(target: Element, timeoutMs: number = 300): Promise<void> {
    return new Promise<void>((resolve) => {
      if (typeof MutationObserver === 'undefined') {
        setTimeout(resolve, timeoutMs);
        return;
      }

      let timer: ReturnType<typeof setTimeout> | null = null;
      let observer: MutationObserver | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      };

      timer = setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);

      try {
        observer = new MutationObserver(() => {
          cleanup();
          resolve();
        });

        observer.observe(target, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      } catch {
        cleanup();
        resolve();
      }
    });
  }
}
