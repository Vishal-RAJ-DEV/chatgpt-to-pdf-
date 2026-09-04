/**
 * Content Script — Phase 6 Entry Point.
 *
 * Injected on https://chatgpt.com/* by Chrome Manifest V3.
 * Listens for extension runtime messages, checks DOM health, and executes
 * conversation extraction within page context.
 */

import { checkHealth } from '../adapters/chatgpt/healthCheck';
import { extractConversationAsync, ExtractionError } from '../core/conversation/Extractor';
import { logger } from '../utils/logger';

logger.info('ChatGPT Exporter content script loaded.');

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    const action = (message as { action?: string }).action;

    if (action === 'CHECK_HEALTH') {
      try {
        const health = checkHealth();
        sendResponse({ success: true, health });
      } catch (err) {
        sendResponse({ success: false, error: String(err) });
      }
      return true;
    }

    if (action === 'EXTRACT_CONVERSATION') {
      (async () => {
        try {
          const conversation = await extractConversationAsync();
          sendResponse({ success: true, conversation });
        } catch (err) {
          if (err instanceof ExtractionError) {
            sendResponse({
              success: false,
              error: err.message,
              code: err.code,
            });
          } else {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : String(err),
              code: 'EXTRACTION_FAILED',
            });
          }
        }
      })();
      return true;
    }

    return false;
  });
}
