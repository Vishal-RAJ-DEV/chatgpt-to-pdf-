/**
 * Canonical Default Settings — Phase 5.
 *
 * Single source of truth for default user settings.
 */

import { UserSettings } from './Settings';

export const DEFAULT_SETTINGS: Readonly<UserSettings> = Object.freeze({
  pageSize: 'A4',
  orientation: 'portrait',
  marginTop: '18mm',
  marginRight: '18mm',
  marginBottom: '18mm',
  marginLeft: '18mm',

  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
  baseFontSize: '10pt',
  lineHeight: 1.5,

  showUserMessages: true,
  showAssistantMessages: true,
  showConversationTitle: true,
  showDate: true,
  showFooterPageNumbers: true,

  codeTheme: 'dark',
  headingSpacing: true,
});
