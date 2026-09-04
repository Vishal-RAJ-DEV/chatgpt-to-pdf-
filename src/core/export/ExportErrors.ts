/**
 * Structured Export Errors & Error Codes — Phase 6.1.
 *
 * Defines strongly typed error codes and human-readable error messages
 * for all potential failure points in the export workflow.
 */

export enum ExportErrorCode {
  UNSUPPORTED_PAGE = 'UNSUPPORTED_PAGE',
  CONVERSATION_NOT_READY = 'CONVERSATION_NOT_READY',
  STREAMING_IN_PROGRESS = 'STREAMING_IN_PROGRESS',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  EXTRACTION_EMPTY_SUSPICIOUS = 'EXTRACTION_EMPTY_SUSPICIOUS',
  EXTRACTION_PARTIAL = 'EXTRACTION_PARTIAL',
  RENDER_FAILED = 'RENDER_FAILED',
  PRINT_FAILED = 'PRINT_FAILED',
  PRINT_TIMEOUT = 'PRINT_TIMEOUT',
  EXPORT_IN_PROGRESS = 'EXPORT_IN_PROGRESS',
  CONVERSATION_INCOMPLETE = 'CONVERSATION_INCOMPLETE',
}

const ERROR_USER_MESSAGES: Record<ExportErrorCode, string> = {
  [ExportErrorCode.UNSUPPORTED_PAGE]: 'Open a ChatGPT conversation first.',
  [ExportErrorCode.CONVERSATION_NOT_READY]: 'ChatGPT page is not fully loaded. Please wait a moment.',
  [ExportErrorCode.STREAMING_IN_PROGRESS]: 'ChatGPT is still generating a response. Wait until it finishes.',
  [ExportErrorCode.CONVERSATION_NOT_FOUND]: 'Could not find a valid ChatGPT conversation on this page.',
  [ExportErrorCode.EXTRACTION_FAILED]: 'Failed to extract conversation content. Please try refreshing.',
  [ExportErrorCode.EXTRACTION_EMPTY_SUSPICIOUS]: 'Conversation container was found, but no messages could be extracted.',
  [ExportErrorCode.EXTRACTION_PARTIAL]: 'Conversation content was partially extracted.',
  [ExportErrorCode.RENDER_FAILED]: 'Failed to render document. Please check settings.',
  [ExportErrorCode.PRINT_FAILED]: 'Could not open browser print dialog. Please try again.',
  [ExportErrorCode.PRINT_TIMEOUT]: 'Print preparation timed out. Please try again.',
  [ExportErrorCode.EXPORT_IN_PROGRESS]: 'An export is already running. Please wait.',
  [ExportErrorCode.CONVERSATION_INCOMPLETE]: 'Could not collect the complete conversation. Please try again.',
};

export class ExportError extends Error {
  public readonly code: ExportErrorCode;
  public readonly userMessage: string;

  constructor(code: ExportErrorCode, message?: string) {
    const defaultUserMsg = ERROR_USER_MESSAGES[code] || 'Export failed. Please try again.';
    super(message || defaultUserMsg);
    this.name = 'ExportError';
    this.code = code;
    this.userMessage = defaultUserMsg;

    // Restore prototype chain for Error extension
    Object.setPrototypeOf(this, ExportError.prototype);
  }
}
