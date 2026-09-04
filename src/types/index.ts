/**
 * Type definitions export for ChatGPT PDF Exporter
 * Re-exports normalized domain models from src/core/conversation/Model.ts
 */

export * from '../core/conversation/Model';

/**
 * User-configurable export settings schema.
 */
export interface ExportSettings {
  content: {
    includeUserMessages: boolean;
    includeAssistantMessages: boolean;
    includeTitle: boolean;
    includeDateTime: boolean;
    includeSourceUrl: boolean;
    showSeparators: boolean;
  };
  page: {
    format: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
    margins: {
      top: number; // mm
      right: number; // mm
      bottom: number; // mm
      left: number; // mm
    };
    showPageNumbers: boolean;
  };
  typography: {
    fontFamily: string;
    fontSize: number; // pt
    lineHeight: number;
  };
  code: {
    fontFamily: string;
    fontSize: number; // pt
    wrapLines: boolean;
  };
  appearance: {
    theme: 'light' | 'dark';
  };
}
