/**
 * ChatGPT DevTools DOM Discovery Module — Phase 2.
 *
 * Development-only diagnostic tool for inspecting live ChatGPT DOM structures.
 * Performs safe, non-mutating inspection of conversation containers, turns,
 * roles, content roots, code blocks, tables, and title metadata.
 */

export interface DOMInspectionReport {
  timestamp: string;
  url: string;
  hasMainContainer: boolean;
  mainContainerSelector: string | null;
  turnCount: number;
  userTurnCount: number;
  assistantTurnCount: number;
  unknownRoleTurnCount: number;
  hasMarkdownProse: boolean;
  codeBlockCount: number;
  tableCount: number;
  detectedTitle: string;
  detectedConversationId: string | null;
  isStreaming: boolean;
}

/**
 * Inspect the current document and generate a structural report.
 */
export function inspectDOM(root: Document | Element = document): DOMInspectionReport {
  const containerCandidates = [
    '[data-testid="conversation-turns-container"]',
    'main .flex.flex-col',
    'main',
  ];

  let mainContainerSelector: string | null = null;
  let containerEl: Element | null = null;

  for (const selector of containerCandidates) {
    const el = root.querySelector(selector);
    if (el) {
      mainContainerSelector = selector;
      containerEl = el;
      break;
    }
  }

  // Turn candidates
  const turnCandidates = root.querySelectorAll(
    '[data-testid^="conversation-turn-"], article[data-testid^="conversation-turn-"], div[data-message-author-role]'
  );

  let userTurnCount = 0;
  let assistantTurnCount = 0;
  let unknownRoleTurnCount = 0;

  turnCandidates.forEach((turn) => {
    const role = turn.getAttribute('data-message-author-role');
    if (role === 'user') {
      userTurnCount++;
    } else if (role === 'assistant') {
      assistantTurnCount++;
    } else {
      // Check data-testid attribute fallback
      const testId = turn.getAttribute('data-testid') || '';
      if (testId.includes('user')) {
        userTurnCount++;
      } else if (testId.includes('assistant')) {
        assistantTurnCount++;
      } else {
        unknownRoleTurnCount++;
      }
    }
  });

  const markdownProseEls = root.querySelectorAll('.markdown.prose, .prose, .agent-turn');
  const codeBlockEls = root.querySelectorAll('pre code, pre');
  const tableEls = root.querySelectorAll('table');

  // Title extraction
  let detectedTitle = 'ChatGPT Conversation';
  if (typeof document !== 'undefined' && document.title) {
    detectedTitle = document.title.replace(/\s*-\s*ChatGPT\s*$/i, '').trim() || detectedTitle;
  }

  // Conversation ID extraction from URL
  let detectedConversationId: string | null = null;
  if (typeof window !== 'undefined' && window.location) {
    const match = window.location.pathname.match(/\/c\/([a-f0-9-]+)/i);
    if (match) {
      detectedConversationId = match[1];
    }
  }

  // Streaming detection
  const isStreaming = root.querySelector('.result-streaming, [class*="streaming"]') !== null;

  return {
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    hasMainContainer: containerEl !== null,
    mainContainerSelector,
    turnCount: turnCandidates.length,
    userTurnCount,
    assistantTurnCount,
    unknownRoleTurnCount,
    hasMarkdownProse: markdownProseEls.length > 0,
    codeBlockCount: codeBlockEls.length,
    tableCount: tableEls.length,
    detectedTitle,
    detectedConversationId,
    isStreaming,
  };
}

/**
 * Print the inspection report nicely to the console for dev inspection.
 */
export function logDOMReport(report: DOMInspectionReport = inspectDOM()): void {
  console.group('[ChatGPT PDF Exporter] DOM Discovery Report');
  console.log('Timestamp:', report.timestamp);
  console.log('URL:', report.url);
  console.log('Main Container Found:', report.hasMainContainer, `(${report.mainContainerSelector})`);
  console.log(`Turns Total: ${report.turnCount} (User: ${report.userTurnCount}, Assistant: ${report.assistantTurnCount}, Unknown: ${report.unknownRoleTurnCount})`);
  console.log('Markdown Prose Found:', report.hasMarkdownProse);
  console.log('Code Blocks Found:', report.codeBlockCount);
  console.log('Tables Found:', report.tableCount);
  console.log('Detected Title:', report.detectedTitle);
  console.log('Detected Conversation ID:', report.detectedConversationId);
  console.log('Is Response Streaming:', report.isStreaming);
  console.groupEnd();
}
