/**
 * Diagnostic logger for ChatGPT PDF Exporter.
 *
 * Provides namespaced console output so extension messages are
 * easy to identify in the DevTools console.
 */

const PREFIX = '[ChatGPT PDF Exporter]';

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
};
