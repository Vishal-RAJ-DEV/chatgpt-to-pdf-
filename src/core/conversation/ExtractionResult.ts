/**
 * Extraction Result & Health Model — Phase 9.
 *
 * Encapsulates the output of conversation extraction alongside diagnostic status,
 * warnings, errors, and message counts. Decoupled from rendering and Chrome APIs.
 */

import { Conversation } from './Model';
import { DiagnosticEntry } from '../../utils/Diagnostics';

export type ExtractionStatus = 'success' | 'partial' | 'empty' | 'suspicious_empty' | 'failure';

export interface ExtractionCounts {
  readonly turns: number;
  readonly user: number;
  readonly assistant: number;
  readonly unknown: number;
  readonly blocks: number;
}

export interface ExtractionResult {
  readonly status: ExtractionStatus;
  readonly conversation: Conversation | null;
  readonly warnings: readonly DiagnosticEntry[];
  readonly errors: readonly DiagnosticEntry[];
  readonly counts: ExtractionCounts;
}
