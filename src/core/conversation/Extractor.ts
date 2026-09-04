/**
 * ChatGPT Conversation Extractor — Phase 3C.
 *
 * Consumes DOM structures discovered by `ChatGPTAdapter` and delegates content parsing to
 * `RichContentExtractor` to build normalized `Conversation` domain model objects.
 *
 * Strict Architectural Rules:
 *   - Does NOT contain hardcoded ChatGPT CSS/data-attribute selectors.
 *   - Relies strictly on `ChatGPTAdapter` discovery methods and `RichContentExtractor`.
 *   - NEVER logs private user prompt text or assistant responses.
 *   - Implements deterministic message IDs (no Math.random()).
 */

import {
  Conversation,
  Message,
  MessageRole,
  ContentBlock,
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
import { extractContentBlocks, normalizeText } from './RichContentExtractor';

export type ExtractionErrorCode =
  | 'UNSUPPORTED_HOST'
  | 'STREAMING_IN_PROGRESS'
  | 'CONVERSATION_NOT_FOUND'
  | 'NO_TURNS_FOUND'
  | 'INCOMPLETE_CONVERSATION'
  | 'LONG_CONVERSATION_TIMEOUT';

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

export { normalizeText };

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
 * Helper re-export for plain clean text extraction from a content root element.
 */
export function extractCleanText(contentRoot: Element): string {
  if (!contentRoot) return '';
  const blocks = extractContentBlocks(contentRoot);
  return blocks.map((b) => ('text' in b ? (b as { text: string }).text : '')).filter(Boolean).join('\n');
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

    let blocks: ContentBlock[] = [];

    if (contentRoot) {
      blocks = extractContentBlocks(contentRoot);
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

/**
 * Asynchronous long-conversation extractor supporting virtualized DOM structures.
 */
export async function extractConversationAsync(
  root: Document | Element = typeof document !== 'undefined' ? document : (null as unknown as Document),
  urlPath: string = typeof window !== 'undefined' ? window.location.pathname : ''
): Promise<Conversation> {
  const { LongConversationExtractor } = await import('./LongConversationExtractor');
  const extractor = new LongConversationExtractor();
  return extractor.extractLongConversation(root, urlPath);
}
