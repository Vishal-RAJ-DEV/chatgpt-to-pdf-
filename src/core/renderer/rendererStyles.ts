/**
 * Document Renderer CSS Styles — Phase 8B Professional Conversation & Content Layout.
 *
 * Generates print-ready, technical-report-oriented CSS for printable HTML output
 * based on centralized design tokens and user RenderOptions.
 */

import { RenderOptions } from './RenderTypes';
import { DEFAULT_DESIGN_TOKENS } from './tokens';

/**
 * Generate standalone CSS rules based on rendering options and design tokens.
 */
export function generateDocumentStyles(options: RenderOptions): string {
  const tokens = DEFAULT_DESIGN_TOKENS;

  const isA4 = options.pageSize === 'A4';
  const pageDimensions = isA4
    ? options.orientation === 'landscape'
      ? `${tokens.document.pageSizeA4Height} ${tokens.document.pageSizeA4Width}`
      : `${tokens.document.pageSizeA4Width} ${tokens.document.pageSizeA4Height}`
    : options.orientation === 'landscape'
    ? `${tokens.document.pageSizeLetterHeight} ${tokens.document.pageSizeLetterWidth}`
    : `${tokens.document.pageSizeLetterWidth} ${tokens.document.pageSizeLetterHeight}`;

  const isDarkCode = options.codeTheme === 'dark';
  const codeBg = isDarkCode ? tokens.colors.codeDarkBg : tokens.colors.codeLightBg;
  const codeText = isDarkCode ? tokens.colors.codeDarkText : tokens.colors.codeLightText;
  const codeBorder = isDarkCode ? tokens.colors.codeDarkBorder : tokens.colors.codeLightBorder;
  const codeHeaderBg = isDarkCode ? tokens.colors.codeDarkHeaderBg : tokens.colors.codeLightHeaderBg;

  const userFontFamily = options.fontFamily || tokens.typography.fontFamilyBody;
  const userBaseFontSize = options.baseFontSize || tokens.typography.sizeBody;
  const userLineHeight = options.lineHeight || tokens.typography.lineHeightBody;

  return `
    /* ── Reset & Base Geometry ─────────────────────────────────────────── */
    @page {
      size: ${pageDimensions};
      margin-top: ${options.marginTop || tokens.document.defaultMarginTop};
      margin-right: ${options.marginRight || tokens.document.defaultMarginRight};
      margin-bottom: ${options.marginBottom || tokens.document.defaultMarginBottom};
      margin-left: ${options.marginLeft || tokens.document.defaultMarginLeft};
      @bottom-right {
        content: ${options.showFooterPageNumbers ? 'counter(page)' : '""'};
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      background: ${tokens.colors.bgDocument};
      color: ${tokens.colors.textPrimary};
      font-family: ${userFontFamily};
      font-size: ${userBaseFontSize};
      line-height: ${userLineHeight};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      padding: 0;
    }

    .document {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }

    /* ── Document Header ────────────────────────────────────────────────── */
    .document-header {
      border-bottom: 1px solid ${tokens.colors.borderLight};
      padding-bottom: ${tokens.spacing.documentHeaderBottomPadding};
      margin-bottom: ${tokens.spacing.documentHeaderBottomMargin};
      break-after: avoid;
    }

    .document-title {
      font-family: ${tokens.typography.fontFamilyHeading};
      font-size: ${tokens.typography.sizeTitle};
      font-weight: ${tokens.typography.weightBold};
      color: ${tokens.colors.headingText};
      line-height: ${tokens.typography.lineHeightTitle};
      letter-spacing: -0.01em;
      margin-bottom: 6px;
    }

    .document-metadata {
      font-size: ${tokens.typography.sizeSmall};
      color: ${tokens.colors.textMuted};
      display: flex;
      gap: 16px;
    }

    /* ── Conversation & Message Stream ──────────────────────────────────── */
    .conversation {
      display: flex;
      flex-direction: column;
      gap: ${tokens.spacing.messageGap};
    }

    .message {
      break-inside: avoid;
      padding: ${tokens.spacing.messagePadding};
      border-radius: 6px;
      border: 1px solid ${tokens.colors.borderLight};
    }

    .message-user {
      background: ${tokens.colors.userBg};
      border-left: ${tokens.spacing.messageBorderWidth} solid ${tokens.colors.userAccent};
    }

    .message-assistant {
      background: ${tokens.colors.assistantBg};
      border-left: ${tokens.spacing.messageBorderWidth} solid ${tokens.colors.assistantAccent};
    }

    .message-role {
      font-size: ${tokens.typography.sizeSmall};
      font-weight: ${tokens.typography.weightSemibold};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .message-user .message-role {
      color: ${tokens.colors.userRoleText};
    }

    .message-assistant .message-role {
      color: ${tokens.colors.assistantRoleText};
    }

    .message-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* ── Paragraphs & Typography ────────────────────────────────────────── */
    p {
      margin-bottom: ${tokens.spacing.paragraphMarginBottom};
      color: ${tokens.colors.textPrimary};
    }

    /* ── Links ───────────────────────────────────────────────────────────── */
    a {
      color: ${tokens.colors.userAccent};
      text-decoration: underline;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    /* ── Headings ────────────────────────────────────────────────────────── */
    h1, h2, h3, h4, h5, h6 {
      font-family: ${tokens.typography.fontFamilyHeading};
      color: ${tokens.colors.headingText};
      font-weight: ${tokens.typography.weightSemibold};
      line-height: ${tokens.typography.lineHeightHeading};
      margin-top: ${options.headingSpacing ? tokens.spacing.headingMarginTop : '8px'};
      margin-bottom: ${tokens.spacing.headingMarginBottom};
      break-after: avoid;
    }

    h1 { font-size: ${tokens.typography.sizeH1}; font-weight: ${tokens.typography.weightBold}; }
    h2 { font-size: ${tokens.typography.sizeH2}; }
    h3 { font-size: ${tokens.typography.sizeH3}; }
    h4 { font-size: ${tokens.typography.sizeH4}; }
    h5 { font-size: ${tokens.typography.sizeH5}; }
    h6 { font-size: ${tokens.typography.sizeH6}; }

    /* ── Lists ───────────────────────────────────────────────────────────── */
    ul, ol {
      padding-left: ${tokens.spacing.listPaddingLeft};
      margin-bottom: ${tokens.spacing.paragraphMarginBottom};
    }

    li {
      margin-bottom: ${tokens.spacing.listItemMarginBottom};
    }

    ul ul, ol ol, ul ol, ol ul {
      margin-top: 4px;
      margin-bottom: 4px;
    }

    /* ── Code Blocks ─────────────────────────────────────────────────────── */
    .code-wrapper {
      break-inside: avoid;
      margin: ${tokens.spacing.blockMargin} 0;
      border-radius: 6px;
      border: 1px solid ${codeBorder};
      background: ${codeBg};
      overflow: hidden;
    }

    .code-header {
      background: ${codeHeaderBg};
      color: ${isDarkCode ? '#94a3b8' : '#475569'};
      font-family: ${tokens.typography.fontFamilyCode};
      font-size: ${tokens.typography.sizeSmall};
      padding: 4px 12px;
      text-transform: lowercase;
      border-bottom: 1px solid ${codeBorder};
    }

    pre {
      margin: 0;
      padding: ${tokens.spacing.codePadding};
      background: ${codeBg};
      color: ${codeText};
      font-family: ${tokens.typography.fontFamilyCode};
      font-size: ${tokens.typography.sizeCode};
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-break: break-word;
      overflow-x: auto;
    }

    pre code {
      font-family: inherit;
      font-size: inherit;
    }

    /* Inline Code */
    code {
      font-family: ${tokens.typography.fontFamilyCode};
      font-size: 0.9em;
      background: ${isDarkCode ? '#334155' : '#f1f5f9'};
      color: ${isDarkCode ? '#f8fafc' : '#0f172a'};
      padding: 2px 5px;
      border-radius: 4px;
    }

    /* ── Tables ──────────────────────────────────────────────────────────── */
    .table-wrapper {
      break-inside: avoid;
      margin: ${tokens.spacing.blockMargin} 0;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95em;
    }

    th, td {
      border: 1px solid ${tokens.colors.tableBorder};
      padding: ${tokens.spacing.tableCellPadding};
      text-align: left;
      overflow-wrap: break-word;
      word-break: break-word;
    }

    th {
      background: ${tokens.colors.tableHeaderBg};
      font-weight: ${tokens.typography.weightSemibold};
      color: ${tokens.colors.headingText};
    }

    tr:nth-child(even) td {
      background: ${tokens.colors.tableRowEvenBg};
    }

    /* ── Blockquotes ─────────────────────────────────────────────────────── */
    blockquote {
      break-inside: avoid;
      border-left: 4px solid ${tokens.colors.quoteBorder};
      background: ${tokens.colors.quoteBg};
      padding: ${tokens.spacing.quotePadding};
      margin: ${tokens.spacing.blockMargin} 0;
      font-style: italic;
      color: ${tokens.colors.quoteText};
    }

    /* ── Images ──────────────────────────────────────────────────────────── */
    .image-wrapper {
      break-inside: avoid;
      margin: ${tokens.spacing.blockMargin} 0;
      text-align: center;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      border: 1px solid ${tokens.colors.borderLight};
    }

    .image-caption {
      font-size: ${tokens.typography.sizeSmall};
      color: ${tokens.colors.textMuted};
      margin-top: 4px;
    }

    /* ── Math ────────────────────────────────────────────────────────────── */
    .math-block {
      break-inside: avoid;
      margin: ${tokens.spacing.blockMargin} 0;
      padding: 8px 12px;
      background: ${tokens.colors.quoteBg};
      border: 1px solid ${tokens.colors.borderLight};
      border-radius: 4px;
      font-family: "KaTeX_Main", "Times New Roman", serif;
      font-size: 1.05em;
    }

    .math-display {
      text-align: center;
    }

    .math-inline {
      display: inline-block;
      padding: 1px 4px;
    }

    /* ── Footer ──────────────────────────────────────────────────────────── */
    .document-footer {
      margin-top: ${tokens.spacing.footerMarginTop};
      padding-top: ${tokens.spacing.footerPaddingTop};
      border-top: 1px solid ${tokens.colors.borderLight};
      display: flex;
      justify-content: space-between;
      font-size: ${tokens.typography.sizeSmall};
      color: ${tokens.colors.textMuted};
    }
  `;
}
