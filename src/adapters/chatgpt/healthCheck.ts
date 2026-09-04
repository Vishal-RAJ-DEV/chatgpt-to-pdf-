/**
 * ChatGPT Adapter Health Check — Phase 1.
 *
 * Returns a minimal diagnostic status indicating whether the
 * extension is running on a supported host with a ready document.
 */

import { isSupportedHost, isDocumentReady } from './ChatGPTAdapter';

export interface HealthStatus {
  supportedHost: boolean;
  documentReady: boolean;
}

/**
 * Run a basic environment health check.
 */
export function checkHealth(): HealthStatus {
  return {
    supportedHost: isSupportedHost(),
    documentReady: isDocumentReady(),
  };
}
