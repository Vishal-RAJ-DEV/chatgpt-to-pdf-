/**
 * Long Conversation Extractor — Phase 7 Final Hardening.
 *
 * Handles virtualized ChatGPT DOM structures where not all conversation turns are
 * mounted in the DOM simultaneously.
 *
 * Traversal Completeness Rules:
 *   1. Traversal MUST verify reaching both top and bottom boundaries of the scroll container.
 *   2. Progress on each scroll step is determined by observable evidence (scrollTop, scrollHeight,
 *      mounted turn IDs, or newly discovered turn count).
 *   3. Stagnation (no progress for maxStagnantIterations) is treated as an UNRESOLVED failure and
 *      throws ExtractionError('INCOMPLETE_CONVERSATION'). It NEVER force-jumps to boundaries or breaks with success.
 *   4. Identity hierarchy: data-message-id > stable data-testid (conversation-turn-N) > positional turn index.
 *      Content alone MUST NEVER merge two distinct turns.
 *   5. Metadata completeness = 'complete' is ONLY set when full traversal completes successfully.
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
  /** Maximum consecutive iterations without discovering new turns or scroll progress before aborting. Default: 5 */
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

interface TraversalState {
  scrollTop: number;
  scrollHeight: number;
  mountedTurnKeys: string;
  discoveredCount: number;
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

/**
 * Captures the current observable state of the DOM and scroller for progress detection.
 */
function captureTraversalState(
  container: HTMLElement,
  root: Document | Element,
  discoveredCount: number
): TraversalState {
  const candidates = findTurnCandidates(root);
  const keys = candidates
    .map((el, i) => getDeterministicMessageId(el, i))
    .sort()
    .join(',');

  return {
    scrollTop: container.scrollTop,
    scrollHeight: container.scrollHeight,
    mountedTurnKeys: keys,
    discoveredCount,
  };
}

/**
 * Determines whether observable progress occurred between two traversal steps.
 */
function hasTraversalProgress(prev: TraversalState, curr: TraversalState): boolean {
  // 1. New unique conversation turns collected
  if (curr.discoveredCount > prev.discoveredCount) return true;
  // 2. scrollTop changed meaningfully (>= 5px)
  if (Math.abs(curr.scrollTop - prev.scrollTop) >= 5) return true;
  // 3. scrollHeight changed
  if (curr.scrollHeight !== prev.scrollHeight) return true;
  // 4. Set of mounted turn IDs / test IDs in DOM changed
  if (curr.mountedTurnKeys !== prev.mountedTurnKeys) return true;

  return false;
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

        // Identity hierarchy:
        //  1. data-message-id attribute (Primary)
        //  2. data-testid attribute (e.g. conversation-turn-1)
        //  3. positional turn index fallback (turn-N)
        // Note: Content fingerprint is NEVER used to overwrite message ID or collapse distinct turns.
        const messageId = getDeterministicMessageId(turnEl, globalDiscoveryCounter);
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

          const stateBefore = captureTraversalState(scrollContainer, root, discoveredMap.size);

          this.scroller.scrollByPx(scrollContainer, -400);
          await this.scroller.waitForDomMutation(scrollContainer, this.options.stepDelayMs);
          collectMountedTurns();

          const stateAfter = captureTraversalState(scrollContainer, root, discoveredMap.size);
          iterations++;

          if (hasTraversalProgress(stateBefore, stateAfter)) {
            stagnantCount = 0;
          } else {
            stagnantCount++;
            if (stagnantCount >= this.options.maxStagnantIterations) {
              throw new ExtractionError(
                'INCOMPLETE_CONVERSATION',
                'Long conversation extraction stagnant without progress before reaching top boundary.'
              );
            }
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

          const stateBefore = captureTraversalState(scrollContainer, root, discoveredMap.size);

          this.scroller.scrollByPx(scrollContainer, 400);
          await this.scroller.waitForDomMutation(scrollContainer, this.options.stepDelayMs);
          collectMountedTurns();

          const stateAfter = captureTraversalState(scrollContainer, root, discoveredMap.size);
          iterations++;

          if (hasTraversalProgress(stateBefore, stateAfter)) {
            stagnantCount = 0;
          } else {
            stagnantCount++;
            if (stagnantCount >= this.options.maxStagnantIterations) {
              throw new ExtractionError(
                'INCOMPLETE_CONVERSATION',
                'Long conversation extraction stagnant without progress before reaching bottom boundary.'
              );
            }
          }
        }
        hasReachedBottom = this.scroller.isAtBottom(scrollContainer);
      }

      // Step 3: Explicit Completeness Assertion — Fail closed if boundaries unverified
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
