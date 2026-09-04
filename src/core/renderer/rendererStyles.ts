/**
 * Document Renderer CSS Styles — Phase 4.
 *
 * Generates print-ready, document-oriented CSS for printable HTML output.
 */

import { RenderOptions } from './RenderTypes';

/**
 * Generate standalone CSS rules based on rendering options.
 */
export function generateDocumentStyles(options: RenderOptions): string {
  const isA4 = options.pageSize === 'A4';
  const pageDimensions = isA4
    ? options.orientation === 'landscape'
      ? '297mm 210mm'
      : '210mm 297mm'
    : options.orientation === 'landscape'
    ? '11in 8.5in'
    : '8.5in 11in';

  const isDarkCode = options.codeTheme === 'dark';
  const codeBg = isDarkCode ? '#1e1e1e' : '#f8fafc';
  const codeText = isDarkCode ? '#d4d4d4' : '#0f172a';
  const codeBorder = isDarkCode ? '#333333' : '#e2e8f0';

  return `
    /* Reset & Base Geometry */
    @page {
      size: ${pageDimensions};
      margin-top: ${options.marginTop};
      margin-right: ${options.marginRight};
      margin-bottom: ${options.marginBottom};
      margin-left: ${options.marginLeft};
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
      background: #ffffff;
      color: #111827;
      font-family: ${options.fontFamily};
      font-size: ${options.baseFontSize};
      line-height: ${options.lineHeight};
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

    /* Document Header */
    .document-header {
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 12px;
      margin-bottom: 24px;
      break-after: avoid;
    }

    .document-title {
      font-size: 1.8em;
      font-weight: 700;
      color: #111827;
      line-height: 1.25;
      margin-bottom: 6px;
    }

    .document-metadata {
      font-size: 0.85em;
      color: #6b7280;
      display: flex;
      gap: 16px;
    }

    /* Conversation & Message Cards */
    .conversation {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .message {
      break-inside: avoid;
      padding: 14px 16px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }

    .message-user {
      background: #f9fafb;
      border-left: 4px solid #2563eb;
    }

    .message-assistant {
      background: #ffffff;
      border-left: 4px solid #10b981;
    }

    .message-role {
      font-size: 0.75em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .message-user .message-role {
      color: #1d4ed8;
    }

    .message-assistant .message-role {
      color: #047857;
    }

    .message-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Paragraphs */
    p {
      margin-bottom: 6px;
      color: #1f2937;
    }

    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      color: #111827;
      font-weight: 700;
      line-height: 1.3;
      margin-top: ${options.headingSpacing ? '14px' : '6px'};
      margin-bottom: 6px;
      break-after: avoid;
    }

    h1 { font-size: 1.5em; }
    h2 { font-size: 1.3em; }
    h3 { font-size: 1.15em; }
    h4 { font-size: 1.05em; }
    h5 { font-size: 1.0em; }
    h6 { font-size: 0.9em; }

    /* Lists */
    ul, ol {
      padding-left: 20px;
      margin-bottom: 8px;
    }

    li {
      margin-bottom: 4px;
    }

    /* Code Blocks */
    .code-wrapper {
      break-inside: avoid;
      margin: 10px 0;
      border-radius: 6px;
      border: 1px solid ${codeBorder};
      background: ${codeBg};
      overflow: hidden;
    }

    .code-header {
      background: ${isDarkCode ? '#2d2d2d' : '#e2e8f0'};
      color: ${isDarkCode ? '#9cdcfe' : '#334155'};
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 0.75em;
      padding: 4px 12px;
      text-transform: lowercase;
      border-bottom: 1px solid ${codeBorder};
    }

    pre {
      margin: 0;
      padding: 12px;
      background: ${codeBg};
      color: ${codeText};
      font-family: "JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 0.9em;
      line-height: 1.45;
      white-space: pre;
      overflow-x: auto;
    }

    pre code {
      font-family: inherit;
      font-size: inherit;
    }

    /* Inline Code */
    code {
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 0.9em;
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 5px;
      border-radius: 4px;
    }

    /* Tables */
    .table-wrapper {
      break-inside: avoid;
      margin: 10px 0;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.95em;
    }

    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 12px;
      text-align: left;
      word-break: break-word;
    }

    th {
      background: #f3f4f6;
      font-weight: 600;
    }

    tr:nth-child(even) td {
      background: #f9fafb;
    }

    /* Blockquotes */
    blockquote {
      break-inside: avoid;
      border-left: 4px solid #3b82f6;
      background: #f8fafc;
      padding: 8px 14px;
      margin: 8px 0;
      font-style: italic;
      color: #334155;
    }

    /* Images */
    .image-wrapper {
      break-inside: avoid;
      margin: 10px 0;
      text-align: center;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }

    .image-caption {
      font-size: 0.8em;
      color: #6b7280;
      margin-top: 4px;
    }

    /* Math */
    .math-block {
      break-inside: avoid;
      margin: 10px 0;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
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

    /* Footer */
    .document-footer {
      margin-top: 30px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 0.8em;
      color: #9ca3af;
    }
  `;
}
