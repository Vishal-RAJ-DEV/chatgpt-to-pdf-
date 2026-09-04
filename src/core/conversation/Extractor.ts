/**
 * Plain ChatGPT Conversation Extractor — Phase 3B.
 *
 * Consumes DOM structures discovered by `ChatGPTAdapter` and transforms them into a pure
 * normalized `Conversation` domain model object.
 *
 * Strict Architectural Rules:
 *   - Does NOT contain hardcoded ChatGPT CSS/data-attribute selectors.
 *   - Relies strictly on `ChatGPTAdapter` discovery methods.
 *   - NEVER logs private user prompt text or assistant responses.
 *   - Implements deterministic message IDs (no Math.random()).
 */

import {
  Conversation,
  Message,
  MessageRole,
  ParagraphBlock,
  ExtractionMetadata,
} from './Model';

import {
  findTurnCandidates,
  getRoleFromElement,
  findContentRoot,
  getConversationTitle,
  getConversationId,
  isStreaming,
  isSupportedHost,
} from '../../adapters/chatgpt/ChatGPTAdapter';

import { checkHealth } from '../../adapters/chatgpt/healthCheck';
import { logger } from '../../utils/logger';

export type ExtractionErrorCode =
  | 'UNSUPPORTED_HOST'
  | 'STREAMING_IN_PROGRESS'
  | 'CONVERSATION_NOT_FOUND'
  | 'NO_TURNS_FOUND';

/**
 * Typed error thrown when conversation extraction cannot proceed safely.
 */
export class ExtractionError extends Error {
  constructor(
    public readonly code: ExtractionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/**
 * Normalizes text content:
 *   - Normalizes CRLF/CR to LF (\n).
 *   - Trims outer whitespace.
 *   - Collapses 3+ consecutive newlines down to 2 (\n\n) while preserving multiline formatting.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  const lines = text.replace(/\r\n|\r/g, '\n').split('\n');
  const trimmedLines = lines.map((line) => line.trim());
  const joined = trimmedLines.join('\n').trim();
  return joined.replace(/\n{3,}/g, '\n\n');
}

/**
 * Derives a deterministic message ID for a turn element.
 */
export function getDeterministicMessageId(turnElement: Element, index: number): string {
  const msgIdAttr = turnElement.getAttribute('data-message-id');
  if (msgIdAttr && msgIdAttr.trim()) {
    return msgIdAttr.trim();
  }

  const testIdAttr = turnElement.getAttribute('data-testid');
  if (testIdAttr && testIdAttr.trim()) {
    return testIdAttr.trim();
  }

  return `turn-${index + 1}`;
}

/**
 * Extracts plain text from a content root element while excluding UI control text
 * (such as "Copy code" buttons, edit prompt labels, or toolbar elements).
 */
export function extractCleanText(contentRoot: Element): string {
  if (!contentRoot) return '';

  // Clone node so DOM mutations do not affect live page
  const clone = contentRoot.cloneNode(true) as Element;

  // Remove UI control elements from cloned subtree
  const uiSelectors = [
    'button',
    '.copy-code-button',
    '[aria-label*="Copy"]',
    '[aria-label*="Edit"]',
    '.flex.items-center.justify-between',
  ];

  uiSelectors.forEach((sel) => {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  });

  return normalizeText(clone.textContent || '');
}

/**
 * Extracts a normalized `Conversation` object from the current ChatGPT DOM.
 *
 * @param root Document or Element containing the ChatGPT DOM.
 * @param urlPath Optional current URL pathname (defaults to window.location.pathname).
 * @returns Normalized `Conversation` object.
 * @throws `ExtractionError` if extraction cannot proceed safely (e.g. streaming or host mismatch).
 */
export function extractConversation(
  root: Document | Element = typeof document !== 'undefined' ? document : (null as unknown as Document),
  urlPath: string = typeof window !== 'undefined' ? window.location.pathname : ''
): Conversation {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'chatgpt.com';

  if (!isSupportedHost(currentHost)) {
    logger.warn('Extraction aborted: unsupported host host=', currentHost);
    throw new ExtractionError(
      'UNSUPPORTED_HOST',
      `Host '${currentHost}' is not supported for ChatGPT conversation extraction.`
    );
  }

  if (isStreaming(root)) {
    logger.info('Extraction aborted: assistant response is actively streaming.');
    throw new ExtractionError(
      'STREAMING_IN_PROGRESS',
      'Conversation response is currently generating. Please wait for streaming to complete.'
    );
  }

  const turns = findTurnCandidates(root);
  if (turns.length === 0) {
    logger.warn('Extraction completed with no turn candidates found.');
  }

  const title = getConversationTitle(root);
  const conversationId = getConversationId(urlPath);
  const fullUrl = typeof window !== 'undefined' ? window.location.href : `https://chatgpt.com${urlPath}`;

  const messages: Message[] = [];
  let unknownRoleCount = 0;

  turns.forEach((turnEl, index) => {
    const role: MessageRole = getRoleFromElement(turnEl) || 'unknown';
    if (role === 'unknown') {
      unknownRoleCount++;
    }

    const messageId = getDeterministicMessageId(turnEl, index);
    const contentRoot = findContentRoot(turnEl);

    const blocks: ParagraphBlock[] = [];

    if (contentRoot) {
      const cleanText = extractCleanText(contentRoot);
      if (cleanText.length > 0) {
        blocks.push({
          type: 'paragraph',
          text: cleanText,
        });
      }
    }

    messages.push({
      id: messageId,
      role,
      blocks,
    });
  });

  // Calculate extraction confidence
  const health = checkHealth(root);
  let confidence: 'high' | 'medium' | 'low' = 'high';
  if (turns.length === 0 || health.confidence === 'none' || health.confidence === 'low') {
    confidence = 'low';
  } else if (unknownRoleCount > 0 || health.confidence === 'medium') {
    confidence = 'medium';
  }

  logger.info(
    `Extraction successful. turns=${messages.length}, unknownRoles=${unknownRoleCount}, confidence=${confidence}`
  );

  const metadata: ExtractionMetadata = {
    source: 'chatgpt.com',
    extractedAt: new Date().toISOString(),
    adapterVersion: '0.1.0',
    confidence,
  };

  return {
    id: conversationId,
    title,
    url: fullUrl,
    createdAt: new Date().toISOString(),
    messages,
    metadata,
  };
}
