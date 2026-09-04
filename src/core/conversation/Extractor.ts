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

import { ExtractionResult, ExtractionStatus } from './ExtractionResult';
import { createDiagnosticEntry, DiagnosticCode, DiagnosticEntry } from '../../utils/Diagnostics';

import {
  findConversationRoot,
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
/**
 * Extracts a normalized `Conversation` object alongside structured diagnostics and extraction status.
 */
export function extractConversationWithResult(
  root: Document | Element = typeof document !== 'undefined' ? document : (null as unknown as Document),
  urlPath: string = typeof window !== 'undefined' ? window.location.pathname : ''
): ExtractionResult {
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'chatgpt.com';
  const warnings: DiagnosticEntry[] = [];
  const errors: DiagnosticEntry[] = [];

  if (!isSupportedHost(currentHost)) {
    const err = createDiagnosticEntry(
      'error',
      'UNSUPPORTED_HOST' as unknown as DiagnosticCode,
      `Host '${currentHost}' is not supported for ChatGPT conversation extraction.`,
      { host: currentHost }
    );
    logger.diagnostic(err);
    return {
      status: 'failure',
      conversation: null,
      warnings: [],
      errors: [err],
      counts: { turns: 0, user: 0, assistant: 0, unknown: 0, blocks: 0 },
    };
  }

  if (isStreaming(root)) {
    const info = createDiagnosticEntry(
      'info',
      'STREAMING_IN_PROGRESS' as unknown as DiagnosticCode,
      'Conversation response is currently generating.'
    );
    logger.diagnostic(info);
    return {
      status: 'failure',
      conversation: null,
      warnings: [info],
      errors: [],
      counts: { turns: 0, user: 0, assistant: 0, unknown: 0, blocks: 0 },
    };
  }

  const conversationRoot = findConversationRoot(root);
  const turns = findTurnCandidates(root);

  // Detect suspicious empty extraction vs legitimate empty
  if (turns.length === 0) {
    if (conversationRoot || (root && root.querySelector && root.querySelector('main'))) {
      const warn = createDiagnosticEntry(
        'warning',
        'EXTRACTION_EMPTY_SUSPICIOUS',
        'Conversation container was located, but no turn candidates could be extracted.',
        { hasConversationRoot: Boolean(conversationRoot) }
      );
      warnings.push(warn);
      logger.diagnostic(warn);

      return {
        status: 'suspicious_empty',
        conversation: null,
        warnings,
        errors: [],
        counts: { turns: 0, user: 0, assistant: 0, unknown: 0, blocks: 0 },
      };
    } else {
      const info = createDiagnosticEntry(
        'info',
        'ADAPTER_CONTAINER_NOT_FOUND',
        'No conversation container or turn candidates found.'
      );
      warnings.push(info);
      return {
        status: 'empty',
        conversation: null,
        warnings,
        errors: [],
        counts: { turns: 0, user: 0, assistant: 0, unknown: 0, blocks: 0 },
      };
    }
  }

  const title = getConversationTitle(root);
  const conversationId = getConversationId(urlPath);
  const fullUrl = typeof window !== 'undefined' ? window.location.href : `https://chatgpt.com${urlPath}`;

  const messages: Message[] = [];
  let userCount = 0;
  let assistantCount = 0;
  let unknownRoleCount = 0;
  let totalBlocks = 0;

  turns.forEach((turnEl, index) => {
    const role: MessageRole = getRoleFromElement(turnEl) || 'unknown';
    if (role === 'user') userCount++;
    else if (role === 'assistant') assistantCount++;
    else unknownRoleCount++;

    const messageId = getDeterministicMessageId(turnEl, index);
    const contentRoot = findContentRoot(turnEl);

    let blocks: ContentBlock[] = [];

    if (contentRoot) {
      blocks = extractContentBlocks(contentRoot);
      totalBlocks += blocks.length;
    } else {
      const warn = createDiagnosticEntry(
        'warning',
        'ADAPTER_MESSAGE_NOT_FOUND',
        `Could not locate content root for turn ${index + 1}.`,
        { turnIndex: index + 1, role }
      );
      warnings.push(warn);
      logger.diagnostic(warn);
    }

    messages.push({
      id: messageId,
      role,
      blocks,
    });
  });

  // Calculate extraction confidence & status
  const health = checkHealth(root);
  let confidence: 'high' | 'medium' | 'low' = 'high';
  let status: ExtractionStatus = 'success';

  if (health.confidence === 'none' || health.confidence === 'low') {
    confidence = 'low';
    status = 'partial';
  } else if (unknownRoleCount > 0 || health.confidence === 'medium' || warnings.length > 0) {
    confidence = 'medium';
    status = 'partial';
  }

  if (status === 'partial') {
    const warn = createDiagnosticEntry(
      'warning',
      'EXTRACTION_PARTIAL',
      'Conversation was extracted with potential partial issues or unknown roles.',
      { turns: messages.length, unknownRoles: unknownRoleCount, confidence }
    );
    warnings.push(warn);
    logger.diagnostic(warn);
  }

  const metadata: ExtractionMetadata = {
    source: 'chatgpt.com',
    extractedAt: new Date().toISOString(),
    adapterVersion: '0.1.0',
    confidence,
  };

  const conversation: Conversation = {
    id: conversationId,
    title,
    url: fullUrl,
    createdAt: new Date().toISOString(),
    messages,
    metadata,
  };

  return {
    status,
    conversation,
    warnings,
    errors,
    counts: {
      turns: messages.length,
      user: userCount,
      assistant: assistantCount,
      unknown: unknownRoleCount,
      blocks: totalBlocks,
    },
  };
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
  const result = extractConversationWithResult(root, urlPath);

  if (result.status === 'failure' || !result.conversation) {
    const firstErr = result.errors[0] || result.warnings[0];
    const code = firstErr ? (firstErr.code as unknown as ExtractionErrorCode) : 'CONVERSATION_NOT_FOUND';
    const msg = firstErr ? firstErr.message : 'Failed to extract conversation content.';
    throw new ExtractionError(code, msg);
  }

  return result.conversation;
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
