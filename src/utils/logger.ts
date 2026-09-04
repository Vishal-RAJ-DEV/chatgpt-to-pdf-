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
    if (entry.level === 'error') {
      console.error(formatted, entry.context || '');
    } else if (entry.level === 'warning') {
      console.warn(formatted, entry.context || '');
    } else if (debugMode) {
      console.log(formatted, entry.context || '');
    }
  },
};
