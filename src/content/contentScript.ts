/**
 * Content Script — Phase 1 entry point.
 *
 * Injected on https://chatgpt.com/* by the Chrome extension manifest.
 * At this phase it only performs diagnostic logging to prove the
 * extension is loaded and running.
 */

import { logger } from '../utils/logger';
import { checkHealth } from '../adapters/chatgpt/healthCheck';

function main(): void {
  logger.info('Content script loaded');

  const health = checkHealth();
  logger.info('Host supported:', health.supportedHost);
  logger.info('Document ready:', health.documentReady);
}

main();
