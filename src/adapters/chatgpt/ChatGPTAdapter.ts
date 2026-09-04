/**
 * ChatGPT Adapter — Phase 1 placeholder.
 *
 * Provides minimal environment detection only.
 * Real DOM extraction will be implemented in a later phase.
 */

const SUPPORTED_HOSTNAMES = ['chatgpt.com', 'www.chatgpt.com'];

/**
 * Check whether the current page is a supported ChatGPT host.
 */
export function isSupportedHost(hostname: string = window.location.hostname): boolean {
  return SUPPORTED_HOSTNAMES.includes(hostname);
}

/**
 * Check whether the document has finished loading enough for
 * content-script work to begin.
 */
export function isDocumentReady(readyState: DocumentReadyState = document.readyState): boolean {
  return readyState === 'complete' || readyState === 'interactive';
}
