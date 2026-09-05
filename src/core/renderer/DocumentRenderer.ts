/**
 * Pure Document Renderer — Phase 8B Professional Conversation & Content Layout.
 *
 * Converts a normalized `Conversation` domain model object into a complete, standalone,
 * printable HTML document string suitable for local browser printing and PDF generation.
 *
 * Strict Architectural Guarantees:
 *   - MUST NOT import ChatGPTAdapter or ChatGPT selectors.
 *   - MUST NOT depend on Chrome Extension APIs.
 *   - MUST NOT perform network requests or download images.
 *   - MUST NOT mutate the input Conversation object.
 *   - MUST escape ALL untrusted model strings to prevent HTML injection vulnerabilities.
 *   - MUST reject dangerous URL schemes (javascript:, vbscript:, data:text/html).
 */

import {
  Conversation,
  Message,
  ContentBlock,
  ParagraphBlock,
  HeadingBlock,
  CodeBlock,
  ListBlock,
  ListItem,
  QuoteBlock,
  TableBlock,
  ImageBlock,
  MathBlock,
  InlineNode,
} from '../conversation/Model';

import { sanitizeFilename } from '../utils/filenameSanitizer';
import { RenderOptions, DEFAULT_RENDER_OPTIONS } from './RenderTypes';
import { generateDocumentStyles } from './rendererStyles';
import { createDiagnosticEntry } from '../../utils/Diagnostics';
import { logger } from '../../utils/logger';


/**
 * Escapes HTML-special characters to prevent XSS / markup injection.
 */
export function escapeHtml(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates and sanitizes URL strings.
 * Rejects dangerous protocols (javascript:, vbscript:, data:text/html).
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html')
  ) {
    return '';
  }

  return escapeHtml(trimmed);
}

/**
 * Formats an ISO 8601 date string into a human-readable format.
 */
export function formatDate(isoString: string | undefined): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return escapeHtml(isoString);
    return escapeHtml(
      date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    );
  } catch {
    return escapeHtml(isoString);
  }
}

/**
 * Render individual InlineNode to HTML string with security escaping and URL sanitization.
 */
function renderInlineNode(node: InlineNode): string {
  switch (node.type) {
    case 'text':
      return escapeHtml(node.text);
    case 'code':
      return `<code>${escapeHtml(node.code)}</code>`;
    case 'link': {
      const safeHref = sanitizeUrl(node.href);
      const linkText = escapeHtml(node.text || node.href);
      if (safeHref) {
        return `<a href="${safeHref}">${linkText}</a>`;
      }
      return linkText;
    }
  }
}

/**
 * Parses plain text string for inline markdown code, markdown links, or raw URLs.
 * Deterministic fallback parser when explicit `inlines` array is not provided.
 */
export function parseInlineText(text: string): InlineNode[] {
  if (!text) return [];

  const nodes: InlineNode[] = [];
  const inlineRegex = /(`[^`\n]+`)|(\[([^\]]+)\]\(([^)\s]+)\))|(https?:\/\/[^\s<]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      const codeContent = match[1].slice(1, -1);
      nodes.push({ type: 'code', code: codeContent });
    } else if (match[2]) {
      const linkText = match[3];
      const linkUrl = match[4];
      nodes.push({ type: 'link', href: linkUrl, text: linkText });
    } else if (match[5]) {
      const url = match[5];
      nodes.push({ type: 'link', href: url, text: url });
    }

    lastIndex = inlineRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return nodes;
}

/**
 * Renders inline content as HTML string, using explicit inlines if present or parsing text.
 */
export function renderInlineText(text: string, inlines?: readonly InlineNode[]): string {
  if (inlines && inlines.length > 0) {
    return inlines.map(renderInlineNode).join('');
  }
  const nodes = parseInlineText(text);
  if (nodes.length === 0) {
    return escapeHtml(text);
  }
  return nodes.map(renderInlineNode).join('');
}

/**
 * Render a single paragraph block.
 */
function renderParagraph(block: ParagraphBlock): string {
  return `<p>${renderInlineText(block.text, block.inlines)}</p>`;
}

/**
 * Render a heading block (H1-H6).
 */
function renderHeading(block: HeadingBlock): string {
  const level = block.level >= 1 && block.level <= 6 ? block.level : 2;
  return `<h${level}>${renderInlineText(block.text, block.inlines)}</h${level}>`;
}

/**
 * Render a code block.
 * Raw code indentation and line breaks are strictly preserved inside <pre><code>.
 * Code contents are 100% HTML-escaped.
 */
function renderCode(block: CodeBlock): string {
  const lang = block.language ? escapeHtml(block.language.toLowerCase()) : '';
  const headerHtml = lang
    ? `<div class="code-header"><span>${lang}</span></div>`
    : '';
  const codeClass = lang ? ` class="language-${lang}"` : '';

  return `<div class="code-wrapper">${headerHtml}<pre><code${codeClass}>${escapeHtml(block.code)}</code></pre></div>`;
}

/**
 * Recursively render ListItem hierarchies with correct semantic list tag preservation.
 */
function renderListItems(items: readonly ListItem[], parentOrdered: boolean = false): string {
  return items
    .map((item) => {
      const itemHtml = renderInlineText(item.text, item.inlines);
      let childList = '';
      if (item.children && item.children.length > 0) {
        const isChildOrdered = item.ordered !== undefined ? item.ordered : parentOrdered;
        const tag = isChildOrdered ? 'ol' : 'ul';
        childList = `<${tag}>${renderListItems(item.children, isChildOrdered)}</${tag}>`;
      }
      return `<li>${itemHtml}${childList}</li>`;
    })
    .join('');
}

/**
 * Render a list block (ordered or unordered).
 */
function renderList(block: ListBlock): string {
  const tag = block.ordered ? 'ol' : 'ul';
  return `<${tag}>${renderListItems(block.items, block.ordered)}</${tag}>`;
}

/**
 * Render a blockquote block.
 */
function renderQuote(block: QuoteBlock): string {
  return `<blockquote>${renderInlineText(block.text, block.inlines)}</blockquote>`;
}

/**
 * Render a table block.
 */
function renderTable(block: TableBlock): string {
  const headersHtml =
    block.headers.length > 0
      ? `<thead><tr>${block.headers.map((h) => `<th>${renderInlineText(h)}</th>`).join('')}</tr></thead>`
      : '';

  const rowsHtml =
    block.rows.length > 0
      ? `<tbody>${block.rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${renderInlineText(cell)}</td>`).join('')}</tr>`
          )
          .join('')}</tbody>`
      : '';

  return `<div class="table-wrapper"><table>${headersHtml}${rowsHtml}</table></div>`;
}

/**
 * Render an image block.
 * Responsive sizing max-width:100%; height:auto;.
 * NOTE: loading="lazy" is intentionally omitted so print/PDF generation renders images reliably.
 */
function renderImage(block: ImageBlock): string {
  const safeSrc = sanitizeUrl(block.src);
  if (!safeSrc) return '';

  const altHtml = block.alt ? ` alt="${escapeHtml(block.alt)}"` : '';
  const captionHtml = block.alt
    ? `<div class="image-caption">${escapeHtml(block.alt)}</div>`
    : '';

  return `<div class="image-wrapper"><img src="${safeSrc}"${altHtml} />${captionHtml}</div>`;
}

/**
 * Render a KaTeX math block as text/LaTeX representation.
 */
function renderMath(block: MathBlock): string {
  const displayClass = block.displayMode ? 'math-display' : 'math-inline';
  return `<div class="math-block ${displayClass}">${escapeHtml(block.expression)}</div>`;
}

/**
 * Render a single ContentBlock.
 */
function renderBlock(block: ContentBlock): string {
  if (!block || typeof block !== 'object') {
    return '';
  }

  try {
    switch (block.type) {
      case 'paragraph':
        return renderParagraph(block);
      case 'heading':
        return renderHeading(block);
      case 'code':
        return renderCode(block);
      case 'list':
        return renderList(block);
      case 'quote':
        return renderQuote(block);
      case 'table':
        return renderTable(block);
      case 'image':
        return renderImage(block);
      case 'math':
        return renderMath(block);
      default: {
        // Safe fallback for unknown block types
        const unknownBlock = block as Record<string, unknown>;
        const entry = createDiagnosticEntry(
          'warning',
          'RENDER_UNKNOWN_BLOCK',
          'Unknown block type encountered during rendering.',
          { blockType: String(unknownBlock?.type || 'unknown') }
        );
        logger.diagnostic(entry);
        return `<p class="fallback-block">${escapeHtml(JSON.stringify(unknownBlock))}</p>`;
      }
    }
  } catch (err) {
    return `<p class="fallback-block">[Render Error: Unable to display block]</p>`;
  }
}

/**
 * Render a single Message turn card.
 */
function renderMessage(message: Message, showRoleLabels: boolean = true): string {
  const roleClass = message.role === 'user' ? 'message-user' : 'message-assistant';
  const roleLabel = message.role === 'user' ? 'User' : 'Assistant';

  const roleHtml = showRoleLabels
    ? `<div class="message-role">${escapeHtml(roleLabel)}</div>`
    : '';

  const blocksHtml = message.blocks.map(renderBlock).join('');

  return `
    <article class="message ${roleClass}">
      ${roleHtml}
      <div class="message-body">
        ${blocksHtml}
      </div>
    </article>
  `;
}

/**
 * Main Entry Point: transforms a `Conversation` model into a complete standalone HTML document string.
 *
 * @param conversation The normalized conversation domain model instance.
 * @param options Optional rendering configuration overrides.
 * @returns Standalone <!doctype html> string suitable for browser printing.
 */
export function renderConversation(
  conversation: Conversation,
  options?: Partial<RenderOptions>
): string {
  const opts: RenderOptions = { ...DEFAULT_RENDER_OPTIONS, ...options };
  const stylesCss = generateDocumentStyles(opts);

  // Filter messages based on role options
  const filteredMessages = conversation.messages.filter((msg) => {
    if (msg.role === 'user' && !opts.showUserMessages) return false;
    if (msg.role === 'assistant' && !opts.showAssistantMessages) return false;
    return true;
  });

  const messagesHtml = filteredMessages.length > 0
    ? filteredMessages.map((msg) => renderMessage(msg, opts.showRoleLabels)).join('')
    : '<div class="empty-conversation-notice"><p>[No messages selected for export in settings]</p></div>';

  const titleHtml = opts.showConversationTitle
    ? `<h1 class="document-title">${escapeHtml(conversation.title)}</h1>`
    : '';

  const dateStr = formatDate(conversation.createdAt);
  const dateHtml = opts.showDate && dateStr
    ? `<span>Exported on ${dateStr}</span>`
    : '';

  const safeSourceUrl = opts.showConversationSource ? sanitizeUrl(conversation.url) : '';
  const sourceHtml = safeSourceUrl
    ? `<span>Source: <a href="${safeSourceUrl}">${escapeHtml(conversation.url)}</a></span>`
    : '';

  const metaItems = [dateHtml, sourceHtml].filter(Boolean);
  const metaHtml = metaItems.length > 0
    ? `<div class="document-metadata">${metaItems.join('')}</div>`
    : '';

  const headerHtml =
    opts.showConversationTitle || metaItems.length > 0
      ? `<header class="document-header">
          ${titleHtml}
          ${metaHtml}
        </header>`
      : '';

  const footerHtml = opts.showFooterPageNumbers
    ? `<footer class="document-footer">
        <span>${escapeHtml(conversation.title)}</span>
        <span class="page-number"></span>
      </footer>`
    : '';

  const safeHeadTitle = sanitizeFilename(conversation.title);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(safeHeadTitle)}</title>
  <style>${stylesCss}</style>
</head>
<body>
  <main class="document">
    ${headerHtml}
    <section class="conversation">
      ${messagesHtml}
    </section>
    ${footerHtml}
  </main>
</body>
</html>`;
}
