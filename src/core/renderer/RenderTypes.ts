/**
 * Document Renderer Types & Default Options — Phase 4.
 *
 * Defines renderer-level configuration schema for document geometry,
 * page size, margins, typography, role filters, themes, and page numbers.
 */

export interface RenderOptions {
  pageSize: 'A4' | 'LETTER';
  orientation: 'portrait' | 'landscape';
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;

  fontFamily: string;
  baseFontSize: string;
  lineHeight: number;

  showConversationTitle: boolean;
  showDate: boolean;
  showUserMessages: boolean;
  showAssistantMessages: boolean;
  showFooterPageNumbers: boolean;

  codeTheme: 'light' | 'dark';
  headingSpacing: boolean;
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  pageSize: 'A4',
  orientation: 'portrait',
  marginTop: '18mm',
  marginRight: '18mm',
  marginBottom: '18mm',
  marginLeft: '18mm',

  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
  baseFontSize: '10pt',
  lineHeight: 1.5,

  showConversationTitle: true,
  showDate: true,
  showUserMessages: true,
  showAssistantMessages: true,
  showFooterPageNumbers: true,

  codeTheme: 'dark',
  headingSpacing: true,
};
