/**
 * ChatGPT DOM Selectors Registry — Phase 2 Evidence-Based Selectors.
 *
 * All selectors in this registry are ordered by reliability (Primary -> Fallback).
 * Each selector set includes explicit confidence ratings based on direct DOM inspection:
 *   - HIGH: Semantic data-attributes or standard HTML elements.
 *   - MEDIUM: Stable wrapper classes or structural patterns.
 *   - LOW: Generic element attributes or dynamic class fallbacks.
 */

export interface SelectorEntry {
  selector: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

export const chatGPTSelectors = {
  /**
   * Main conversation container holding all message turns.
   */
  conversationContainer: [
    {
      selector: '[data-testid="conversation-turns-container"]',
      confidence: 'HIGH',
      description: 'Primary semantic test ID container for message turns.',
    },
    {
      selector: 'main .flex-1.overflow-hidden',
      confidence: 'MEDIUM',
      description: 'Main scrollable content region inside ChatGPT layout.',
    },
    {
      selector: 'main',
      confidence: 'LOW',
      description: 'Fallback to HTML5 main landmark container.',
    },
  ] as SelectorEntry[],

  /**
   * Individual conversation turn roots (user prompt + assistant turn cards).
   */
  turn: [
    {
      selector: '[data-testid^="conversation-turn-"]',
      confidence: 'HIGH',
      description: 'Primary indexed turn attribute (e.g. conversation-turn-1).',
    },
    {
      selector: 'article[data-testid^="conversation-turn-"]',
      confidence: 'HIGH',
      description: 'Article landmark with turn test ID.',
    },
    {
      selector: 'div[data-message-author-role]',
      confidence: 'MEDIUM',
      description: 'Fallback to elements bearing explicit author role attribute.',
    },
  ] as SelectorEntry[],

  /**
   * Author role indicators on turn elements.
   */
  roles: {
    userAttribute: 'data-message-author-role="user"',
    assistantAttribute: 'data-message-author-role="assistant"',
    systemAttribute: 'data-message-author-role="system"',
  },

  /**
   * User turn content wrappers.
   */
  userContent: [
    {
      selector: '.user-message-content',
      confidence: 'HIGH',
      description: 'Explicit user prompt wrapper class.',
    },
    {
      selector: '.whitespace-pre-wrap',
      confidence: 'MEDIUM',
      description: 'Class used for preserving whitespace in user prompts.',
    },
    {
      selector: '[data-message-author-role="user"] div',
      confidence: 'LOW',
      description: 'First inner div of a user turn element.',
    },
  ] as SelectorEntry[],

  /**
   * Assistant turn content wrappers.
   */
  assistantContent: [
    {
      selector: '.markdown.prose',
      confidence: 'HIGH',
      description: 'Primary rendered Markdown container for assistant responses.',
    },
    {
      selector: '.agent-turn .prose',
      confidence: 'MEDIUM',
      description: 'Prose container inside agent turn element.',
    },
    {
      selector: '.prose',
      confidence: 'LOW',
      description: 'Generic Tailwind prose container.',
    },
  ] as SelectorEntry[],

  /**
   * Code block elements within assistant turns.
   */
  codeBlock: {
    container: 'pre',
    codeElement: 'code',
    languageBadge: '.flex.items-center.justify-between span, [class*="language-"]',
    copyButton: 'button.copy-code-button, button:has(svg)',
    confidence: 'HIGH' as const,
  },

  /**
   * Table elements within assistant turns.
   */
  table: {
    root: 'table',
    header: 'thead',
    body: 'tbody',
    row: 'tr',
    headerCell: 'th',
    dataCell: 'td',
    confidence: 'HIGH' as const,
  },

  /**
   * Streaming state indicators.
   */
  streaming: [
    {
      selector: '.result-streaming',
      confidence: 'HIGH',
      description: 'Active streaming indicator class applied during response generation.',
    },
    {
      selector: '[class*="streaming"]',
      confidence: 'MEDIUM',
      description: 'Class containing streaming string.',
    },
  ] as SelectorEntry[],
};
