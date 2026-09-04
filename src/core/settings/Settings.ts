/**
 * User Settings Schema — Phase 5.
 *
 * Strongly typed interface for user configuration, decoupled from Chrome APIs
 * and core rendering/extraction modules.
 */

export type PageSize = 'A4' | 'LETTER';
export type PageOrientation = 'portrait' | 'landscape';
export type CodeTheme = 'light' | 'dark';

export interface UserSettings {
  // Page geometry
  pageSize: PageSize;
  orientation: PageOrientation;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;

  // Typography
  fontFamily: string;
  baseFontSize: string;
  lineHeight: number;

  // Content visibility
  showUserMessages: boolean;
  showAssistantMessages: boolean;
  showConversationTitle: boolean;
  showDate: boolean;
  showFooterPageNumbers: boolean;

  // Code formatting
  codeTheme: CodeTheme;

  // Layout
  headingSpacing: boolean;
}

export const CURRENT_SETTINGS_VERSION = 1;

export interface StoredSettings {
  version: number;
  values: UserSettings;
}
