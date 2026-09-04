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
} from '../conversation/Model';

import { RenderOptions, DEFAULT_RENDER_OPTIONS } from './RenderTypes';
import { generateDocumentStyles } from './rendererStyles';

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
 * Render a single paragraph block.
 */
function renderParagraph(block: ParagraphBlock): string {
  return `<p>${escapeHtml(block.text)}</p>`;
}

/**
 * Render a heading block (H1-H6).
 */
function renderHeading(block: HeadingBlock): string {
  const level = block.level >= 1 && block.level <= 6 ? block.level : 2;
  return `<h${level}>${escapeHtml(block.text)}</h${level}>`;
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
      const itemText = escapeHtml(item.text);
      let childList = '';
      if (item.children && item.children.length > 0) {
        const tag = parentOrdered ? 'ol' : 'ul';
        childList = `<${tag}>${renderListItems(item.children, parentOrdered)}</${tag}>`;
      }
      return `<li>${itemText}${childList}</li>`;
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
  return `<blockquote>${escapeHtml(block.text)}</blockquote>`;
}

/**
 * Render a table block.
 */
function renderTable(block: TableBlock): string {
  const headersHtml =
    block.headers.length > 0
      ? `<thead><tr>${block.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`
      : '';

  const rowsHtml =
    block.rows.length > 0
      ? `<tbody>${block.rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
          )
          .join('')}</tbody>`
      : '';

  return `<div class="table-wrapper"><table>${headersHtml}${rowsHtml}</table></div>`;
}

/**
 * Render an image block.
 * Responsive sizing max-width:100%; height:auto;.
 */
function renderImage(block: ImageBlock): string {
  const safeSrc = sanitizeUrl(block.src);
  if (!safeSrc) return '';

  const altHtml = block.alt ? ` alt="${escapeHtml(block.alt)}"` : '';
  const captionHtml = block.alt
    ? `<div class="image-caption">${escapeHtml(block.alt)}</div>`
    : '';

  return `<div class="image-wrapper"><img src="${safeSrc}"${altHtml} loading="lazy" />${captionHtml}</div>`;
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
      return `<p class="fallback-block">${escapeHtml(JSON.stringify(unknownBlock))}</p>`;
    }
  }
}

/**
 * Render a single Message turn card.
 */
function renderMessage(message: Message): string {
  const roleClass = message.role === 'user' ? 'message-user' : 'message-assistant';
  const roleLabel = message.role === 'user' ? 'User' : 'Assistant';

  const blocksHtml = message.blocks.map(renderBlock).join('');

  return `
    <article class="message ${roleClass}">
      <div class="message-role">${escapeHtml(roleLabel)}</div>
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

  const messagesHtml = filteredMessages.map(renderMessage).join('');

  const titleHtml = opts.showConversationTitle
    ? `<h1 class="document-title">${escapeHtml(conversation.title)}</h1>`
    : '';

  const dateStr = formatDate(conversation.createdAt);
  const dateHtml = opts.showDate && dateStr
    ? `<span>Exported on ${dateStr}</span>`
    : '';

  const headerHtml =
    opts.showConversationTitle || (opts.showDate && dateStr)
      ? `<header class="document-header">
          ${titleHtml}
          <div class="document-metadata">
            ${dateHtml}
          </div>
        </header>`
      : '';

  const footerHtml = opts.showFooterPageNumbers
    ? `<footer class="document-footer">
        <span>${escapeHtml(conversation.title)}</span>
        <span class="page-number"></span>
      </footer>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(conversation.title)}</title>
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
