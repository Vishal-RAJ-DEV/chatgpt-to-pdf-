/**
 * Centralized Renderer Design Tokens — Phase 8A.
 *
 * Defines the design system single source of truth for generated PDF documents.
 * Specifies typography scales, spacing ratios, colors, borders, and print layout geometry.
 *
 * Technical Document / Report Visual Target.
 */

export interface DesignTokens {
  typography: {
    fontFamilyBody: string;
    fontFamilyHeading: string;
    fontFamilyCode: string;
    sizeTitle: string;
    sizeH1: string;
    sizeH2: string;
    sizeH3: string;
    sizeH4: string;
    sizeH5: string;
    sizeH6: string;
    sizeBody: string;
    sizeSmall: string;
    sizeCode: string;
    lineHeightBody: number;
    lineHeightHeading: number;
    lineHeightTitle: number;
    weightNormal: number;
    weightMedium: number;
    weightSemibold: number;
    weightBold: number;
  };
  spacing: {
    documentHeaderBottomPadding: string;
    documentHeaderBottomMargin: string;
    messageGap: string;
    messagePadding: string;
    messageBorderWidth: string;
    blockMargin: string;
    paragraphMarginBottom: string;
    headingMarginTop: string;
    headingMarginBottom: string;
    listPaddingLeft: string;
    listItemMarginBottom: string;
    tableCellPadding: string;
    quotePadding: string;
    codePadding: string;
    footerMarginTop: string;
    footerPaddingTop: string;
    borderRadius: string;
    borderRadiusSmall: string;
  };
  colors: {
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    headingText: string;
    bgDocument: string;
    borderLight: string;
    borderMedium: string;
    userAccent: string;
    userBg: string;
    userRoleText: string;
    assistantAccent: string;
    assistantBg: string;
    assistantRoleText: string;
    quoteBg: string;
    quoteBorder: string;
    quoteText: string;
    tableHeaderBg: string;
    tableRowEvenBg: string;
    tableBorder: string;
    codeDarkBg: string;
    codeDarkText: string;
    codeDarkBorder: string;
    codeDarkHeaderBg: string;
    codeLightBg: string;
    codeLightText: string;
    codeLightBorder: string;
    codeLightHeaderBg: string;
    codeInlineDarkBg: string;
    codeInlineDarkText: string;
    codeInlineLightBg: string;
    codeInlineLightText: string;
  };
  document: {
    pageSizeA4Width: string;
    pageSizeA4Height: string;
    pageSizeLetterWidth: string;
    pageSizeLetterHeight: string;
    defaultMarginTop: string;
    defaultMarginRight: string;
    defaultMarginBottom: string;
    defaultMarginLeft: string;
  };
}

export const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  typography: {
    fontFamilyBody: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontFamilyHeading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontFamilyCode: '"JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", Menlo, Courier, monospace',
    sizeTitle: '1.75em',
    sizeH1: '1.45em',
    sizeH2: '1.25em',
    sizeH3: '1.1em',
    sizeH4: '1.0em',
    sizeH5: '0.9em',
    sizeH6: '0.85em',
    sizeBody: '10pt',
    sizeSmall: '8.5pt',
    sizeCode: '8.5pt',
    lineHeightBody: 1.5,
    lineHeightHeading: 1.3,
    lineHeightTitle: 1.25,
    weightNormal: 400,
    weightMedium: 500,
    weightSemibold: 600,
    weightBold: 700,
  },
  spacing: {
    documentHeaderBottomPadding: '14px',
    documentHeaderBottomMargin: '20px',
    messageGap: '16px',
    messagePadding: '12px 16px',
    messageBorderWidth: '3px',
    blockMargin: '10px',
    paragraphMarginBottom: '8px',
    headingMarginTop: '16px',
    headingMarginBottom: '6px',
    listPaddingLeft: '20px',
    listItemMarginBottom: '4px',
    tableCellPadding: '6px 10px',
    quotePadding: '8px 14px',
    codePadding: '10px 14px',
    footerMarginTop: '28px',
    footerPaddingTop: '12px',
    borderRadius: '6px',
    borderRadiusSmall: '4px',
  },
  colors: {
    textPrimary: '#0f172a',       // Slate 900
    textSecondary: '#475569',     // Slate 600
    textMuted: '#64748b',         // Slate 500
    headingText: '#0f172a',       // Slate 900
    bgDocument: '#ffffff',
    borderLight: '#e2e8f0',       // Slate 200
    borderMedium: '#cbd5e1',      // Slate 300
    userAccent: '#2563eb',        // Blue 600
    userBg: '#f8fafc',            // Slate 50
    userRoleText: '#1d4ed8',      // Blue 700
    assistantAccent: '#059669',   // Emerald 600
    assistantBg: '#ffffff',
    assistantRoleText: '#047857', // Emerald 700
    quoteBg: '#f8fafc',
    quoteBorder: '#94a3b8',       // Slate 400
    quoteText: '#334155',
    tableHeaderBg: '#f1f5f9',
    tableRowEvenBg: '#f8fafc',
    tableBorder: '#cbd5e1',
    codeDarkBg: '#1e293b',        // Slate 800
    codeDarkText: '#e2e8f0',
    codeDarkBorder: '#334155',
    codeDarkHeaderBg: '#0f172a',
    codeLightBg: '#f8fafc',
    codeLightText: '#0f172a',
    codeLightBorder: '#cbd5e1',
    codeLightHeaderBg: '#f1f5f9',
    codeInlineDarkBg: '#334155',
    codeInlineDarkText: '#f8fafc',
    codeInlineLightBg: '#f1f5f9',
    codeInlineLightText: '#0f172a',
  },
  document: {
    pageSizeA4Width: '210mm',
    pageSizeA4Height: '297mm',
    pageSizeLetterWidth: '8.5in',
    pageSizeLetterHeight: '11in',
    defaultMarginTop: '18mm',
    defaultMarginRight: '18mm',
    defaultMarginBottom: '18mm',
    defaultMarginLeft: '18mm',
  },
};
