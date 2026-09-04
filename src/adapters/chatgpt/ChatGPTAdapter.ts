/**
 * ChatGPT Adapter — Discovery & DOM Inspection APIs (Phase 2).
 *
 * Implements discovery methods for inspecting ChatGPT DOM structures.
 * Completely decoupled from PDF rendering or extraction models.
 */

import { chatGPTSelectors } from './selectors';

const SUPPORTED_HOSTNAMES = ['chatgpt.com', 'www.chatgpt.com', 'localhost', '127.0.0.1'];

/**
 * Check whether the current page is a supported ChatGPT host.
 */
export function isSupportedHost(hostname: string = typeof window !== 'undefined' ? window.location.hostname : ''): boolean {
  return SUPPORTED_HOSTNAMES.includes(hostname);
}

/**
 * Check whether the document has finished loading enough for
 * content-script work to begin.
 */
export function isDocumentReady(readyState: DocumentReadyState = typeof document !== 'undefined' ? document.readyState : 'complete'): boolean {
  return readyState === 'complete' || readyState === 'interactive';
}

/**
 * Locate the main conversation container in the DOM.
 */
export function findConversationRoot(root: Document | Element = typeof document !== 'undefined' ? document : (null as unknown as Document)): Element | null {
  if (!root) return null;
  for (const entry of chatGPTSelectors.conversationContainer) {
    const el = root.querySelector(entry.selector);
    if (el) return el;
  }
  return null;
}

/**
 * Find all candidate turn elements in the conversation.
 */
export function findTurnCandidates(root: Document | Element = typeof document !== 'undefined' ? document : (null as unknown as Document)): Element[] {
  if (!root) return [];
  const container = findConversationRoot(root) || root;
  for (const entry of chatGPTSelectors.turn) {
    const nodes = container.querySelectorAll(entry.selector);
    if (nodes.length > 0) {
      return Array.from(nodes);
    }
  }
  // Secondary fallback: find elements with data-message-author-role or turn-like testids
  const fallbackNodes = container.querySelectorAll('[data-message-author-role], [data-testid*="conversation-turn-"], article.w-full');
  if (fallbackNodes.length > 0) {
    return Array.from(fallbackNodes);
  }
  return [];
}

/**
 * Determine the role ('user', 'assistant', 'system') of a turn element.
 */
export function getRoleFromElement(element: Element): 'user' | 'assistant' | 'system' | null {
  if (!element) return null;
  const roleAttr = element.getAttribute('data-message-author-role');
  if (roleAttr === 'user' || roleAttr === 'assistant' || roleAttr === 'system') {
    return roleAttr;
  }

  // Fallback checking data-testid attribute string
  const testId = element.getAttribute('data-testid') || '';
  if (testId.includes('user')) return 'user';
  if (testId.includes('assistant')) return 'assistant';

  // Secondary fallback checking class names
  const className = typeof element.className === 'string' ? element.className : '';
  if (className.includes('user')) return 'user';
  if (className.includes('assistant') || className.includes('agent-turn')) return 'assistant';

  return null;
}

/**
 * Find the content root element inside a turn element.
 */
export function findContentRoot(turnElement: Element): Element | null {
  if (!turnElement) return null;
  const role = getRoleFromElement(turnElement);

  if (role === 'user') {
    for (const entry of chatGPTSelectors.userContent) {
      const el = turnElement.querySelector(entry.selector);
      if (el) return el;
    }
  } else if (role === 'assistant') {
    for (const entry of chatGPTSelectors.assistantContent) {
      const el = turnElement.querySelector(entry.selector);
      if (el) return el;
    }
  }

  // Generic fallback if role could not be determined or role-specific selector returned null
  const genericEl = turnElement.querySelector('.markdown.prose, .user-message-content, .prose, .whitespace-pre-wrap');
  if (genericEl) return genericEl;

  return turnElement;
}

/**
 * Extract the conversation title from the page environment.
 */
export function getConversationTitle(root: Document | Element = typeof document !== 'undefined' ? document : (null as unknown as Document)): string {
  const fallback = 'ChatGPT Conversation';

  // Determine target document from root parameter or global document
  const doc = root
    ? root.nodeType === 9
      ? (root as Document)
      : root.ownerDocument
    : typeof document !== 'undefined'
    ? document
    : null;

  if (doc && doc.title) {
    const cleaned = doc.title.replace(/\s*-\s*ChatGPT\s*$/i, '').trim();
    if (cleaned && cleaned.toLowerCase() !== 'chatgpt') {
      return cleaned;
    }
  }

  // Fallback to H1 inside root
  if (root) {
    const h1 = root.querySelector('main h1, h1');
    if (h1 && h1.textContent?.trim()) {
      return h1.textContent.trim();
    }
  }

  return fallback;
}

/**
 * Extract the conversation ID from the URL pathname.
 */
export function getConversationId(urlPath: string = typeof window !== 'undefined' ? window.location.pathname : ''): string | null {
  if (!urlPath) return null;
  const match = urlPath.match(/\/c\/([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

/**
 * Check whether a turn or response is actively streaming.
 */
export function isStreaming(root: Document | Element = typeof document !== 'undefined' ? document : (null as unknown as Document)): boolean {
  if (!root) return false;
  for (const entry of chatGPTSelectors.streaming) {
    if (root.querySelector(entry.selector)) {
      return true;
    }
  }
  return false;
}
