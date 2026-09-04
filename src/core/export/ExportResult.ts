/**
 * Export Result & State Models — Phase 6.
 */

import { ExportErrorCode } from './ExportErrors';

export type ExportState = 'idle' | 'extracting' | 'rendering' | 'printing' | 'success' | 'error';

export interface ExportResult {
  success: boolean;
  state: ExportState;
  errorCode?: ExportErrorCode;
  errorUserMessage?: string;
  timestamp: string;
}
