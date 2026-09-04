/**
 * ChatGPT Adapter Health Check — Extended Diagnostics (Phase 2).
 *
 * Evaluates the live DOM state and returns confidence ratings and detection
 * flags for conversation containers, turns, user turns, and assistant turns.
 */

import {
  isSupportedHost,
  isDocumentReady,
  findConversationRoot,
  findTurnCandidates,
  getRoleFromElement,
} from './ChatGPTAdapter';

export interface HealthStatus {
  supportedHost: boolean;
  documentReady: boolean;
  conversationDetected: boolean;
  turnCandidatesFound: boolean;
  userTurnsFound: boolean;
  assistantTurnsFound: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

/**
 * Perform a comprehensive DOM health check.
 */
export function checkHealth(root: Document | Element = typeof document !== 'undefined' ? document : (null as unknown as Document)): HealthStatus {
  const hostOk = isSupportedHost();
  const readyOk = isDocumentReady();

  if (!root || !hostOk || !readyOk) {
    return {
      supportedHost: hostOk,
      documentReady: readyOk,
      conversationDetected: false,
      turnCandidatesFound: false,
      userTurnsFound: false,
      assistantTurnsFound: false,
      confidence: 'none',
    };
  }

  const container = findConversationRoot(root);
  const conversationDetected = container !== null;
  const turns = findTurnCandidates(root);
  const turnCandidatesFound = turns.length > 0;

  let userTurnsFound = false;
  let assistantTurnsFound = false;

  turns.forEach((turn) => {
    const role = getRoleFromElement(turn);
    if (role === 'user') userTurnsFound = true;
    if (role === 'assistant') assistantTurnsFound = true;
  });

  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';

  if (conversationDetected && turnCandidatesFound && userTurnsFound && assistantTurnsFound) {
    confidence = 'high';
  } else if (turnCandidatesFound && (userTurnsFound || assistantTurnsFound)) {
    confidence = 'medium';
  } else if (conversationDetected || turnCandidatesFound) {
    confidence = 'low';
  }

  return {
    supportedHost: hostOk,
    documentReady: readyOk,
    conversationDetected,
    turnCandidatesFound,
    userTurnsFound,
    assistantTurnsFound,
    confidence,
  };
}
