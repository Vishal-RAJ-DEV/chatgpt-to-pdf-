/**
 * Diagnostic logger for ChatGPT PDF Exporter.
 *
 * Provides namespaced console output so extension messages are
 * easy to identify in the DevTools console.
 */

import { DiagnosticEntry } from './Diagnostics';

const PREFIX = '[ChatGPT PDF Exporter]';

let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function isDebugMode(): boolean {
  return debugMode;
}

export const logger = {
  info: (...args: unknown[]): void => {
    console.log(PREFIX, ...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(PREFIX, ...args);
  },
  error: (...args: unknown[]): void => {
    console.error(PREFIX, ...args);
  },
  diagnostic: (entry: DiagnosticEntry): void => {
    const formatted = `${PREFIX} [${entry.code}] ${entry.message}`;
    const hasContext = entry.context !== undefined && entry.context !== null;

    if (entry.level === 'error') {
      hasContext ? console.error(formatted, entry.context) : console.error(formatted);
    } else if (entry.level === 'warning') {
      hasContext ? console.warn(formatted, entry.context) : console.warn(formatted);
    } else if (debugMode) {
      hasContext ? console.log(formatted, entry.context) : console.log(formatted);
    }
  },
};
