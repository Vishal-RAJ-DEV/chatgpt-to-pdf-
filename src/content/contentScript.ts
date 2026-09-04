/**
 * Content Script — Phase 2 entry point.
 *
 * Injected on https://chatgpt.com/* by the Chrome extension manifest.
 * Performs diagnostic logging and DOM health check reporting.
 */

import { logger } from '../utils/logger';
import { checkHealth } from '../adapters/chatgpt/healthCheck';

function main(): void {
  logger.info('Content script loaded');

  const health = checkHealth();
  logger.info('Host supported:', health.supportedHost);
  logger.info('Document ready:', health.documentReady);
  logger.info('Conversation detected:', health.conversationDetected);
  logger.info('Turns found:', health.turnCandidatesFound);
  logger.info('User turns found:', health.userTurnsFound);
  logger.info('Assistant turns found:', health.assistantTurnsFound);
  logger.info('DOM Health confidence:', health.confidence);
}

main();
