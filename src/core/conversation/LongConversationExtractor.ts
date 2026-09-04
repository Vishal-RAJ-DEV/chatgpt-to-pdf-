/**
 * Long Conversation Extractor — Phase 7.
 *
 * Handles virtualized ChatGPT DOM structures where not all conversation turns are
 * mounted in the DOM simultaneously.
 *
 * Traversal Completeness Rules:
 *   1. Traversal MUST verify reaching both top and bottom boundaries of the scroll container.
 *   2. If maxDurationMs is reached at any point, throws ExtractionError('LONG_CONVERSATION_TIMEOUT').
 *   3. If maxIterations or maxStagnantIterations limit is reached before full traversal,
 *      throws ExtractionError('INCOMPLETE_CONVERSATION').
 *   4. Metadata completeness = 'complete' is ONLY set when full traversal completes successfully.
 *   5. Partial conversation models are NEVER returned as 'complete'.
 *   6. User scroll position is ALWAYS restored in a finally block.
 */

import {
  findTurnCandidates,
  getRoleFromElement,
  findContentRoot,
  getConversationTitle,
  getConversationId,
  isStreaming,
  isSupportedHost,
} from '../../adapters/chatgpt/ChatGPTAdapter';
import { ConversationScroller } from '../../adapters/chatgpt/ConversationScroller';
import { checkHealth } from '../../adapters/chatgpt/healthCheck';
import { logger } from '../../utils/logger';
import { ExtractionError, getDeterministicMessageId } from './Extractor';
import {
  Conversation,
  Message,
  MessageRole,
  ContentBlock,
  ExtractionMetadata,
} from './Model';
import { extractContentBlocks } from './RichContentExtractor';

export interface LongExtractorOptions {
  /** Maximum traversal duration in milliseconds. Default: 20000 */
  maxDurationMs?: number;
  /** Maximum scroll iterations allowed. Default: 60 */
  maxIterations?: number;
  /** Maximum consecutive iterations without discovering new turns before aborting. Default: 5 */
  maxStagnantIterations?: number;
  /** Delay (ms) between scroll steps for layout/mutation settling. Default: 150 */
  stepDelayMs?: number;
}

interface DiscoveredTurn {
  id: string;
  role: MessageRole;
  blocks: ContentBlock[];
  turnIndexHint: number;
}

/**
 * Computes a deterministic content hash signature for fallback turn identity.
 */
export function computeTurnFingerprint(role: string, blocks: readonly ContentBlock[]): string {
  const serialized = blocks
    .map((b) => {
      if ('text' in b) return (b as { text: string }).text;
      if ('code' in b) return (b as { code: string }).code;
      if ('expression' in b) return (b as { expression: string }).expression;
      return b.type;
    })
    .join('|');

  let hash = 5381;
  for (let i = 0; i < serialized.length; i++) {
    hash = (hash * 33) ^ serialized.charCodeAt(i);
  }
  return `${role}-${(hash >>> 0).toString(16)}`;
}

/**
 * Parses numeric turn index from attributes like `conversation-turn-5`.
 */
export function parseTurnIndexHint(turnElement: Element, fallbackIndex: number): number {
  const testId = turnElement.getAttribute('data-testid') || '';
  const match = testId.match(/conversation-turn-(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return fallbackIndex;
}

export class LongConversationExtractor {
  private scroller: ConversationScroller;
  private options: Required<LongExtractorOptions>;

  constructor(scroller?: ConversationScroller, options?: LongExtractorOptions) {
    this.scroller = scroller || new ConversationScroller();
    this.options = {
      maxDurationMs: options?.maxDurationMs ?? 20000,
      maxIterations: options?.maxIterations ?? 60,
      maxStagnantIterations: options?.maxStagnantIterations ?? 5,
      stepDelayMs: options?.stepDelayMs ?? 150,
    };
  }

  /**
   * Extracts the full conversation, scrolling incrementally if virtualized nodes exist.
   * Guarantees complete traversal or throws a specific ExtractionError.
   */
  public async extractLongConversation(
    root: Document | Element = typeof document !== 'undefined' ? document : (null as unknown as Document),
    urlPath: string = typeof window !== 'undefined' ? window.location.pathname : ''
  ): Promise<Conversation> {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'chatgpt.com';

    if (!isSupportedHost(currentHost)) {
      throw new ExtractionError(
        'UNSUPPORTED_HOST',
        `Host '${currentHost}' is not supported for ChatGPT conversation extraction.`
      );
    }

    if (isStreaming(root)) {
      throw new ExtractionError(
        'STREAMING_IN_PROGRESS',
        'Conversation response is currently generating. Please wait for streaming to complete.'
      );
    }

    const scrollContainer = this.scroller.findScrollContainer(root);
    const initialPos = this.scroller.captureScrollPosition(scrollContainer);

    const discoveredMap = new Map<string, DiscoveredTurn>();
    let globalDiscoveryCounter = 0;

    const collectMountedTurns = (): number => {
      const candidates = findTurnCandidates(root);
      let newlyAdded = 0;

      candidates.forEach((turnEl) => {
        const role: MessageRole = getRoleFromElement(turnEl) || 'unknown';
        const contentRoot = findContentRoot(turnEl);
        const blocks = contentRoot ? extractContentBlocks(contentRoot) : [];

        let messageId = getDeterministicMessageId(turnEl, globalDiscoveryCounter);

        if (messageId.startsWith('turn-')) {
          const fingerprint = computeTurnFingerprint(role, blocks);
          messageId = `${role}-${fingerprint}`;
        }

        const indexHint = parseTurnIndexHint(turnEl, globalDiscoveryCounter);

        if (!discoveredMap.has(messageId)) {
          discoveredMap.set(messageId, {
            id: messageId,
            role,
            blocks,
            turnIndexHint: indexHint,
          });
          newlyAdded++;
          globalDiscoveryCounter++;
        }
      });

      return newlyAdded;
    };

    try {
      // Step 1: Initial collection pass
      collectMountedTurns();

      // Step 2: Virtualization Detection
      const isVirtualized = scrollContainer
        ? scrollContainer.scrollHeight > scrollContainer.clientHeight + 100 || !this.scroller.isAtTop(scrollContainer)
        : false;

      let hasReachedTop = !isVirtualized;
      let hasReachedBottom = !isVirtualized;

      if (isVirtualized && scrollContainer) {
        logger.info('Virtualized conversation container detected. Starting incremental traversal...');

        const startTime = Date.now();
        let iterations = 0;
        let stagnantCount = 0;

        // ── Phase A: Scroll UP incrementally towards top to load historical turns ─────────
        while (!this.scroller.isAtTop(scrollContainer)) {
          if (Date.now() - startTime > this.options.maxDurationMs) {
            throw new ExtractionError(
              'LONG_CONVERSATION_TIMEOUT',
              'Long conversation extraction timed out during scroll-up traversal.'
            );
          }
          if (iterations >= this.options.maxIterations) {
            throw new ExtractionError(
              'INCOMPLETE_CONVERSATION',
              'Exceeded maximum scroll iterations during long conversation extraction.'
            );
          }

          this.scroller.scrollByPx(scrollContainer, -400);
          await this.scroller.waitForDomMutation(scrollContainer, this.options.stepDelayMs);

          const added = collectMountedTurns();
          iterations++;

          if (added === 0) {
            stagnantCount++;
            if (stagnantCount >= this.options.maxStagnantIterations) {
              // Forced scroll to top if stagnant
              this.scroller.scrollToTop(scrollContainer);
              await this.scroller.waitForDomMutation(scrollContainer, this.options.stepDelayMs);
              collectMountedTurns();

              if (!this.scroller.isAtTop(scrollContainer)) {
                throw new ExtractionError(
                  'INCOMPLETE_CONVERSATION',
                  'Could not reach top of conversation container after stagnant iterations.'
                );
              }
              break;
            }
          } else {
            stagnantCount = 0;
          }
        }
        hasReachedTop = this.scroller.isAtTop(scrollContainer);

        // ── Phase B: Scroll DOWN incrementally towards bottom to ensure all bottom turns are collected
        stagnantCount = 0;
        while (!this.scroller.isAtBottom(scrollContainer)) {
          if (Date.now() - startTime > this.options.maxDurationMs) {
            throw new ExtractionError(
              'LONG_CONVERSATION_TIMEOUT',
              'Long conversation extraction timed out during scroll-down traversal.'
            );
          }
          if (iterations >= this.options.maxIterations) {
            throw new ExtractionError(
              'INCOMPLETE_CONVERSATION',
              'Exceeded maximum scroll iterations during long conversation extraction.'
            );
          }

          this.scroller.scrollByPx(scrollContainer, 400);
          await this.scroller.waitForDomMutation(scrollContainer, this.options.stepDelayMs);

          const added = collectMountedTurns();
          iterations++;

          if (added === 0) {
            stagnantCount++;
            if (stagnantCount >= this.options.maxStagnantIterations) {
              this.scroller.scrollToBottom(scrollContainer);
              await this.scroller.waitForDomMutation(scrollContainer, this.options.stepDelayMs);
              collectMountedTurns();

              if (!this.scroller.isAtBottom(scrollContainer)) {
                throw new ExtractionError(
                  'INCOMPLETE_CONVERSATION',
                  'Could not reach bottom of conversation container after stagnant iterations.'
                );
              }
              break;
            }
          } else {
            stagnantCount = 0;
          }
        }
        hasReachedBottom = this.scroller.isAtBottom(scrollContainer);
      }

      // Step 3: Explicit Completeness Assertion
      if (!hasReachedTop || !hasReachedBottom) {
        throw new ExtractionError(
          'INCOMPLETE_CONVERSATION',
          'Traversal failed to verify both top and bottom conversation boundaries.'
        );
      }

      // Reconstruct chronological order based on turnIndexHint
      const sortedTurns = Array.from(discoveredMap.values()).sort(
        (a, b) => a.turnIndexHint - b.turnIndexHint
      );

      const messages: Message[] = sortedTurns.map((turn) => ({
        id: turn.id,
        role: turn.role,
        blocks: turn.blocks,
      }));

      const title = getConversationTitle(root);
      const conversationId = getConversationId(urlPath);
      const fullUrl =
        typeof window !== 'undefined' ? window.location.href : `https://chatgpt.com${urlPath}`;

      const health = checkHealth(root);
      let confidence: 'high' | 'medium' | 'low' = 'high';
      if (messages.length === 0 || health.confidence === 'none' || health.confidence === 'low') {
        confidence = 'low';
      }

      const metadata: ExtractionMetadata = {
        source: 'chatgpt.com',
        extractedAt: new Date().toISOString(),
        adapterVersion: '0.1.0',
        confidence,
        completeness: 'complete',
      };

      return {
        id: conversationId,
        title,
        url: fullUrl,
        createdAt: new Date().toISOString(),
        messages,
        metadata,
      };
    } finally {
      // Step 4: Always restore user scroll position
      this.scroller.restoreScrollPosition(initialPos);
    }
  }
}
