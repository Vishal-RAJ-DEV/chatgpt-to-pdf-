/**
 * Rich Content Extraction Engine — Phase 3C.
 *
 * Traverses ChatGPT content root subtrees, recognizes semantic HTML elements,
 * and converts DOM nodes into typed `ContentBlock` objects.
 *
 * Strict Guarantees:
 *   - Preserves exact DOM block sequence order.
 *   - Preserves raw code whitespace and indentation 100% untouched.
 *   - Recursively parses nested lists without text duplication.
 *   - Extracts HTML table matrices with header ordering and empty cell handling.
 *   - Recovers KaTeX LaTeX math expressions.
 *   - Non-mutating UI sanitization (strips buttons, toolbar text, scripts).
 *   - Zero network requests / local processing only.
 */

import {
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
} from './Model';

/**
 * Extracts semantic inline nodes (text, inline <code>, links <a>) from a DOM element.
 */
export function parseInlinesFromElement(el: Element): InlineNode[] {
  const inlines: InlineNode[] = [];

  function traverse(node: Node) {
    if (node.nodeType === 3 /* Node.TEXT_NODE */) {
      const text = node.textContent || '';
      if (text) {
        inlines.push({ type: 'text', text });
      }
      return;
    }

    if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
      const elem = node as Element;
      const tag = elem.tagName.toLowerCase();

      if (tag === 'code') {
        const codeText = elem.textContent || '';
        if (codeText) {
          inlines.push({ type: 'code', code: codeText });
        }
        return;
      }

      if (tag === 'a') {
        const href = elem.getAttribute('href') || '';
        const linkText = elem.textContent || href;
        if (href || linkText) {
          inlines.push({ type: 'link', href, text: linkText });
        }
        return;
      }

      Array.from(elem.childNodes).forEach((child) => traverse(child));
    }
  }

  Array.from(el.childNodes).forEach((child) => traverse(child));

  const merged: InlineNode[] = [];
  for (const item of inlines) {
    if (item.type === 'text') {
      if (merged.length > 0 && merged[merged.length - 1].type === 'text') {
        (merged[merged.length - 1] as { type: 'text'; text: string }).text += item.text;
      } else {
        merged.push({ type: 'text', text: item.text });
      }
    } else {
      merged.push(item);
    }
  }

  const hasSpecialNodes = merged.some((m) => m.type === 'code' || m.type === 'link');
  return hasSpecialNodes ? merged : [];
}

/**
 * Normalizes text while preserving line-by-line leading indentation.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  const normalized = text.replace(/\r\n|\r/g, '\n');
  const lines = normalized.split('\n').map((line) => line.trimEnd());
  const joined = lines.join('\n').replace(/^\n+|\n+$/g, '');
  return joined.replace(/\n{3,}/g, '\n\n');
}

/**
 * Clones a content root element and removes non-content UI elements and unsafe tags.
 */
export function cloneAndSanitizeContent(contentRoot: Element): Element {
  const clone = contentRoot.cloneNode(true) as Element;

  // UI elements to strip
  const uiSelectors = [
    'button',
    '.copy-code-button',
    '[aria-label*="Copy"]',
    '[aria-label*="Edit"]',
    '.flex.items-center.justify-between', // Code block header bar
    '.sr-only', // Screen reader duplicate text
  ];

  uiSelectors.forEach((sel) => {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  });

  // Security sanitization (unsafe executable tags)
  const unsafeSelectors = ['script', 'iframe', 'object', 'embed'];
  unsafeSelectors.forEach((sel) => {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  });

  // Remove event handlers and javascript: links
  clone.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
      if (attr.name === 'href' && attr.value.toLowerCase().trim().startsWith('javascript:')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return clone;
}

/**
 * Parses a paragraph (<p>) element.
 */
function parseParagraph(el: Element): ParagraphBlock | null {
  const text = normalizeText(el.textContent || '');
  if (!text) return null;
  const inlines = parseInlinesFromElement(el);
  return {
    type: 'paragraph',
    text,
    ...(inlines.length > 0 ? { inlines } : {}),
  };
}

/**
 * Parses a heading (<h1> - <h6>) element.
 */
function parseHeading(el: Element): HeadingBlock | null {
  const tag = el.tagName.toLowerCase();
  const levelMatch = tag.match(/^h([1-6])$/);
  if (!levelMatch) return null;

  const level = parseInt(levelMatch[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
  const text = normalizeText(el.textContent || '');
  if (!text) return null;
  const inlines = parseInlinesFromElement(el);

  return {
    type: 'heading',
    level,
    text,
    ...(inlines.length > 0 ? { inlines } : {}),
  };
}

/**
 * Extracts text and inline nodes from the direct content of a list item while excluding nested sub-lists (<ul> / <ol>).
 */
export function extractListItemContent(liEl: Element): { text: string; inlines: InlineNode[] } {
  const inlines: InlineNode[] = [];
  const textParts: string[] = [];

  function traverse(node: Node) {
    if (node.nodeType === 3 /* Node.TEXT_NODE */) {
      const text = node.textContent || '';
      if (text) {
        textParts.push(text);
        inlines.push({ type: 'text', text });
      }
      return;
    }

    if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
      const elem = node as Element;
      const tag = elem.tagName.toLowerCase();

      // STOP TRAVERSAL: Ignore sub-lists (ul / ol) and all their descendants
      if (tag === 'ul' || tag === 'ol') {
        return;
      }

      if (tag === 'code') {
        const codeText = elem.textContent || '';
        if (codeText) {
          textParts.push(codeText);
          inlines.push({ type: 'code', code: codeText });
        }
        return;
      }

      if (tag === 'a') {
        const href = elem.getAttribute('href') || '';
        const linkText = elem.textContent || href;
        if (href || linkText) {
          textParts.push(linkText);
          inlines.push({ type: 'link', href, text: linkText });
        }
        return;
      }

      Array.from(elem.childNodes).forEach((child) => traverse(child));
    }
  }

  Array.from(liEl.childNodes).forEach((child) => traverse(child));

  const mergedInlines: InlineNode[] = [];
  for (const item of inlines) {
    if (item.type === 'text') {
      if (!item.text) continue;
      if (mergedInlines.length > 0 && mergedInlines[mergedInlines.length - 1].type === 'text') {
        (mergedInlines[mergedInlines.length - 1] as { type: 'text'; text: string }).text += item.text;
      } else {
        mergedInlines.push({ type: 'text', text: item.text });
      }
    } else {
      mergedInlines.push(item);
    }
  }

  const rawText = textParts.join('');
  const normalizedText = normalizeText(rawText).trim();

  if (mergedInlines.length > 0 && mergedInlines[0].type === 'text') {
    const trimmedFirst = mergedInlines[0].text.replace(/^\s+/, '');
    if (trimmedFirst) {
      (mergedInlines[0] as { type: 'text'; text: string }).text = trimmedFirst;
    } else {
      mergedInlines.shift();
    }
  }
  if (mergedInlines.length > 0) {
    const last = mergedInlines[mergedInlines.length - 1];
    if (last.type === 'text') {
      const trimmedLast = last.text.replace(/\s+$/, '');
      if (trimmedLast) {
        (mergedInlines[mergedInlines.length - 1] as { type: 'text'; text: string }).text = trimmedLast;
      } else {
        mergedInlines.pop();
      }
    }
  }

  const hasSpecialNodes = mergedInlines.some((m) => m.type === 'code' || m.type === 'link');
  const finalInlines = hasSpecialNodes ? mergedInlines : [];

  return {
    text: normalizedText,
    inlines: finalInlines,
  };
}

/**
 * Recursively parses a single <li> element into a ListItem.
 */
function parseListItem(liEl: Element): ListItem | null {
  // Extract direct text and inline nodes belonging strictly to this item (excluding sub-lists)
  const { text, inlines } = extractListItemContent(liEl);

  // Find immediate child sub-lists belonging directly to this <li>
  const subListEls = Array.from(liEl.querySelectorAll('ul, ol')).filter(
    (subList) => subList.closest('li') === liEl
  );

  const children: ListItem[] = [];
  let childOrdered: boolean | undefined = undefined;

  subListEls.forEach((subListEl) => {
    if (childOrdered === undefined) {
      childOrdered = subListEl.tagName === 'OL';
    }
    Array.from(subListEl.children).forEach((subLi) => {
      if (subLi.tagName === 'LI') {
        const childItem = parseListItem(subLi);
        if (childItem) children.push(childItem);
      }
    });
  });

  if (!text && children.length === 0) return null;

  return {
    text,
    ...(inlines.length > 0 ? { inlines } : {}),
    ...(childOrdered !== undefined ? { ordered: childOrdered } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

/**
 * Parses a list (<ul> or <ol>) element.
 */
function parseList(el: Element): ListBlock | null {
  const ordered = el.tagName === 'OL';
  const items: ListItem[] = [];

  Array.from(el.children).forEach((child) => {
    if (child.tagName === 'LI') {
      const item = parseListItem(child);
      if (item) items.push(item);
    }
  });

  if (items.length === 0) return null;

  return {
    type: 'list',
    ordered,
    items,
  };
}

/**
 * Parses a blockquote (<blockquote>) element.
 */
function parseQuote(el: Element): QuoteBlock | null {
  const text = normalizeText(el.textContent || '');
  if (!text) return null;
  const inlines = parseInlinesFromElement(el);
  return {
    type: 'quote',
    text,
    ...(inlines.length > 0 ? { inlines } : {}),
  };
}

/**
 * Detects programming language tag from a code or pre element.
 */
function detectCodeLanguage(el: Element): string | undefined {
  const codeEl = el.tagName === 'CODE' ? el : el.querySelector('code');
  if (codeEl) {
    const classList = Array.from(codeEl.classList);
    for (const cls of classList) {
      if (cls.startsWith('language-')) {
        return cls.replace(/^language-/, '').trim();
      }
    }
  }

  // Check parent container span if present
  const container = el.closest('.bg-black, pre')?.parentElement;
  if (container) {
    const langSpan = container.querySelector('.flex.items-center span');
    if (langSpan && langSpan.textContent) {
      const text = langSpan.textContent.trim().toLowerCase();
      if (text && !text.includes('copy')) return text;
    }
  }

  return undefined;
}

/**
 * Parses a code block (<pre> or <pre><code>) element.
 * Strictly preserves raw code text, indentation, and internal newlines untouched.
 */
function parseCode(el: Element): CodeBlock | null {
  const codeEl = el.tagName === 'CODE' ? el : el.querySelector('code') || el;
  const rawCode = codeEl.textContent || '';
  if (!rawCode.trim()) return null;

  const language = detectCodeLanguage(el);

  return {
    type: 'code',
    code: rawCode,
    language,
  };
}

/**
 * Parses an HTML table (<table>) element.
 */
function parseTable(el: Element): TableBlock | null {
  const headers: string[] = [];
  const rows: string[][] = [];

  // Parse <thead> headers
  const thEls = el.querySelectorAll('thead th, tr:first-child th');
  thEls.forEach((th) => {
    headers.push(normalizeText(th.textContent || ''));
  });

  // Parse <tbody> rows
  const trEls = el.querySelectorAll('tbody tr');
  trEls.forEach((tr) => {
    const rowCells: string[] = [];
    tr.querySelectorAll('td').forEach((td) => {
      rowCells.push(normalizeText(td.textContent || ''));
    });
    if (rowCells.length > 0) {
      // Pad uneven row length if fewer than headers
      if (headers.length > 0) {
        while (rowCells.length < headers.length) {
          rowCells.push('');
        }
      }
      rows.push(rowCells);
    }
  });

  if (headers.length === 0 && rows.length === 0) return null;

  return {
    type: 'table',
    headers,
    rows,
  };
}

/**
 * Parses an <img> element.
 */
function parseImage(el: Element): ImageBlock | null {
  const src = el.getAttribute('src');
  if (!src) return null;

  // Skip tracking pixels / tiny icons
  const width = el.getAttribute('width');
  const height = el.getAttribute('height');
  if (width === '1' || height === '1') return null;

  const alt = el.getAttribute('alt') || undefined;

  return {
    type: 'image',
    src,
    alt,
  };
}

/**
 * Parses a KaTeX math element (.katex or .katex-display).
 */
function parseMath(el: Element): MathBlock | null {
  const displayMode = el.classList.contains('katex-display') || el.tagName === 'DIV';

  // 1. Try KaTeX annotation element
  const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
  if (annotation && annotation.textContent?.trim()) {
    return {
      type: 'math',
      expression: annotation.textContent.trim(),
      displayMode,
    };
  }

  // 2. Try alttext or data-expr attribute
  const altText = el.getAttribute('alttext') || el.getAttribute('data-expr');
  if (altText && altText.trim()) {
    return {
      type: 'math',
      expression: altText.trim(),
      displayMode,
    };
  }

  // 3. Fallback to text content
  const text = normalizeText(el.textContent || '');
  if (!text) return null;

  return {
    type: 'math',
    expression: text,
    displayMode,
  };
}

/**
 * Process an individual DOM node and append parsed ContentBlock to result.
 */
function processElement(el: Element, blocks: ContentBlock[]): void {
  const tag = el.tagName.toLowerCase();

  // 1. Code Block (<pre>)
  if (tag === 'pre') {
    const block = parseCode(el);
    if (block) blocks.push(block);
    return;
  }

  // 2. Heading (<h1> - <h6>)
  if (/^h[1-6]$/.test(tag)) {
    const block = parseHeading(el);
    if (block) blocks.push(block);
    return;
  }

  // 3. Paragraph (<p>)
  if (tag === 'p') {
    const block = parseParagraph(el);
    if (block) blocks.push(block);
    return;
  }

  // 4. List (<ul> or <ol>)
  if (tag === 'ul' || tag === 'ol') {
    const block = parseList(el);
    if (block) blocks.push(block);
    return;
  }

  // 5. Blockquote (<blockquote>)
  if (tag === 'blockquote') {
    const block = parseQuote(el);
    if (block) blocks.push(block);
    return;
  }

  // 6. Table (<table>)
  if (tag === 'table') {
    const block = parseTable(el);
    if (block) blocks.push(block);
    return;
  }

  // 7. Image (<img>)
  if (tag === 'img') {
    const block = parseImage(el);
    if (block) blocks.push(block);
    return;
  }

  // 8. Math (.katex or .katex-display)
  if (el.classList.contains('katex') || el.classList.contains('katex-display')) {
    const block = parseMath(el);
    if (block) blocks.push(block);
    return;
  }

  // 9. Generic Wrapper (<div>, <section>, <span>) -> recurse children or fallback
  if (el.children.length > 0) {
    Array.from(el.children).forEach((child) => processElement(child, blocks));
  } else {
    // Leaf element text fallback
    const text = normalizeText(el.textContent || '');
    if (text) {
      blocks.push({
        type: 'paragraph',
        text,
      });
    }
  }
}

/**
 * Main entry point: extracts typed `ContentBlock[]` array from a content root element.
 * Preserves strict DOM sequence order.
 */
export function extractContentBlocks(contentRoot: Element): ContentBlock[] {
  if (!contentRoot) return [];

  const sanitized = cloneAndSanitizeContent(contentRoot);
  const blocks: ContentBlock[] = [];

  // Traversal: if top-level element has children, process each direct child
  if (sanitized.children.length > 0) {
    Array.from(sanitized.children).forEach((child) => {
      processElement(child, blocks);
    });
  } else {
    const text = normalizeText(sanitized.textContent || '');
    if (text) {
      blocks.push({
        type: 'paragraph',
        text,
      });
    }
  }

  return blocks;
}
