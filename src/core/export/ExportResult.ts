/**
 * Export Result & State Models — Phase 6.
 */

import { ExportErrorCode } from './ExportErrors';
import { DiagnosticEntry } from '../../utils/Diagnostics';

export type ExportState = 'idle' | 'extracting' | 'rendering' | 'printing' | 'success' | 'warning' | 'error';

export interface ExportResult {
  success: boolean;
  state: ExportState;
  errorCode?: ExportErrorCode;
  errorUserMessage?: string;
  warnings?: readonly DiagnosticEntry[];
  extractionStatus?: string;
  timestamp: string;
}
