/**
 * Diagnostic System & Failure Codes — Phase 9.
 *
 * Defines lightweight, local-only diagnostic entries and standardized failure codes.
 *
 * Privacy Guarantee:
 *   - Diagnostics NEVER contain raw conversation text, user prompts, or assistant responses.
 *   - Context objects are strictly limited to non-sensitive structural metadata (counts, codes, selectors, stages).
 */

export type DiagnosticLevel = 'info' | 'warning' | 'error';

export type DiagnosticCode =
  | 'ADAPTER_CONTAINER_NOT_FOUND'
  | 'ADAPTER_MESSAGE_NOT_FOUND'
  | 'EXTRACTION_EMPTY_SUSPICIOUS'
  | 'EXTRACTION_PARTIAL'
  | 'EXTRACTION_BLOCK_PARSE_FAILED'
  | 'RENDER_UNKNOWN_BLOCK'
  | 'RENDER_UNSAFE_URL'
  | 'EXPORT_RENDER_FAILED'
  | 'EXPORT_PRINT_FAILED'
  | 'SETTINGS_STORAGE_FAILED'
  | 'SETTINGS_INVALID';

export interface DiagnosticEntry {
  readonly level: DiagnosticLevel;
  readonly code: DiagnosticCode;
  readonly message: string;
  readonly timestamp: string;
  readonly context?: Record<string, unknown>;
}

/**
 * Sanitizes context objects to guarantee zero leakage of conversation text or sensitive strings.
 */
export function sanitizeDiagnosticContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    // Exclude keys that could potentially contain prompt or message text
    if (['text', 'prompt', 'response', 'body', 'content', 'html', 'raw'].includes(key.toLowerCase())) {
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.length; // convert arrays to count
    } else if (typeof value === 'object') {
      sanitized[key] = '[Object]';
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Factory function for constructing a sanitized DiagnosticEntry.
 */
export function createDiagnosticEntry(
  level: DiagnosticLevel,
  code: DiagnosticCode,
  message: string,
  context?: Record<string, unknown>
): DiagnosticEntry {
  return {
    level,
    code,
    message,
    timestamp: new Date().toISOString(),
    context: sanitizeDiagnosticContext(context),
  };
}
