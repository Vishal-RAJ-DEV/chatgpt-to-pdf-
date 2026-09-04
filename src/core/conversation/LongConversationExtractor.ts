/**
 * Long Conversation Extractor — Phase 7 Final Hardening.
 *
 * Handles virtualized ChatGPT DOM structures where not all conversation turns are
 * mounted in the DOM simultaneously.
 *
 * Traversal Completeness & Logical Coverage Rules:
 *   1. Traversal MUST verify reaching both top and bottom boundaries of the scroll container.
 *   2. Progress is determined by observable evidence (new turns discovered, coverage set expanded,
 *      mounted DOM turn keys changed, or scrollHeight changed). Physical scroll movement alone without
 *      DOM node changes is NOT progress.
 *   3. Stagnation (no progress for maxStagnantIterations) is treated as an UNRESOLVED failure and
 *      throws ExtractionError('INCOMPLETE_CONVERSATION'). It NEVER force-jumps to boundaries or breaks with success.
 *   4. Logical turn coverage tracking: when numeric conversation-turn-N indices exist, every index from
 *      minIndex to maxIndex must be observed without gaps. Any missing index throws ExtractionError('INCOMPLETE_CONVERSATION').
 *   5. Identity hierarchy: data-message-id > stable data-testid (conversation-turn-N) > positional turn index.
 *      Content alone MUST NEVER merge two distinct turns.
 *   6. Metadata completeness = 'complete' is ONLY set when full traversal and logical coverage complete successfully.
 *   7. User scroll position is ALWAYS restored in a finally block.
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
  /** Maximum consecutive iterations without discovering new turns or DOM progress before aborting. Default: 5 */
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
  coverageCount: number;
}

/**
 * Computes a deterministic content hash signature for fallback turn identity / diagnostics.
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
 * Parses explicit numeric turn index if present on element (e.g. conversation-turn-7 -> 7).
 */
export function parseNumericTurnIndex(turnElement: Element): number | null {
  const testId = turnElement.getAttribute('data-testid') || '';
  const match = testId.match(/conversation-turn-(\d+)/i);
  if (match) {
    const val = parseInt(match[1], 10);
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * Captures the current observable state of the DOM and scroller for progress detection.
 */
function captureTraversalState(
  container: HTMLElement,
  root: Document | Element,
  discoveredCount: number,
  coverageCount: number
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
    coverageCount,
  };
}

/**
 * Determines whether observable progress occurred between two traversal steps.
 * Physical movement alone without DOM node changes or new turns is NOT progress.
 */
function hasTraversalProgress(prev: TraversalState, curr: TraversalState): boolean {
  // 1. New unique conversation turns collected
  if (curr.discoveredCount > prev.discoveredCount) return true;
  // 2. Numeric turn coverage set expanded
  if (curr.coverageCount > prev.coverageCount) return true;
  // 3. Set of mounted turn IDs / test IDs in DOM changed
  if (curr.mountedTurnKeys !== prev.mountedTurnKeys) return true;
  // 4. scrollHeight changed
  if (curr.scrollHeight !== prev.scrollHeight) return true;

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
   * Guarantees complete traversal and logical turn coverage or throws a specific ExtractionError.
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
    const observedTurnIndices = new Set<number>();
    let hasNumericTurnIndices = false;
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
        const messageId = getDeterministicMessageId(turnEl, globalDiscoveryCounter);
        const indexHint = parseTurnIndexHint(turnEl, globalDiscoveryCounter);
        const numIdx = parseNumericTurnIndex(turnEl);

        if (numIdx !== null) {
          observedTurnIndices.add(numIdx);
          hasNumericTurnIndices = true;
        }

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

          const stateBefore = captureTraversalState(
            scrollContainer,
            root,
            discoveredMap.size,
            observedTurnIndices.size
          );

          this.scroller.scrollByPx(scrollContainer, -400);
          await this.scroller.waitForDomMutation(scrollContainer, this.options.stepDelayMs);
          collectMountedTurns();

          const stateAfter = captureTraversalState(
            scrollContainer,
            root,
            discoveredMap.size,
            observedTurnIndices.size
          );
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

          const stateBefore = captureTraversalState(
            scrollContainer,
            root,
            discoveredMap.size,
            observedTurnIndices.size
          );

          this.scroller.scrollByPx(scrollContainer, 400);
          await this.scroller.waitForDomMutation(scrollContainer, this.options.stepDelayMs);
          collectMountedTurns();

          const stateAfter = captureTraversalState(
            scrollContainer,
            root,
            discoveredMap.size,
            observedTurnIndices.size
          );
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

      // Step 3: Explicit Completeness Assertion & Logical Coverage Validation
      if (!hasReachedTop || !hasReachedBottom) {
        throw new ExtractionError(
          'INCOMPLETE_CONVERSATION',
          'Traversal failed to verify both top and bottom conversation boundaries.'
        );
      }

      // If virtualized, validate logical coverage
      if (isVirtualized) {
        if (hasNumericTurnIndices) {
          const sortedIndices = Array.from(observedTurnIndices).sort((a, b) => a - b);
          if (sortedIndices.length === 0) {
            throw new ExtractionError(
              'INCOMPLETE_CONVERSATION',
              'No logical turn indices observed during virtualized conversation traversal.'
            );
          }

          const minIndex = sortedIndices[0];
          const maxIndex = sortedIndices[sortedIndices.length - 1];

          // Check for any missing gaps in numeric index set from minIndex to maxIndex
          for (let idx = minIndex; idx <= maxIndex; idx++) {
            if (!observedTurnIndices.has(idx)) {
              throw new ExtractionError(
                'INCOMPLETE_CONVERSATION',
                `Logical turn index gap detected: conversation-turn-${idx} was never observed.`
              );
            }
          }
        } else {
          // Virtualized conversation without stable numeric turn indices: cannot guarantee full coverage safely
          throw new ExtractionError(
            'INCOMPLETE_CONVERSATION',
            'Cannot verify logical conversation coverage without stable numeric turn indices in virtualized DOM.'
          );
        }
      }

      // Step 4: Reconstruct chronological order based on turnIndexHint
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
      // Step 5: Always restore user scroll position
      this.scroller.restoreScrollPosition(initialPos);
    }
  }
}
