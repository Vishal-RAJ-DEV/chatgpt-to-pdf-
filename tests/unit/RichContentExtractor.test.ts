import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  extractContentBlocks,
  normalizeText,
  cloneAndSanitizeContent,
} from '../../src/core/conversation/RichContentExtractor';
import {
  HeadingBlock,
  CodeBlock,
  ListBlock,
  QuoteBlock,
  TableBlock,
  ImageBlock,
  MathBlock,
} from '../../src/core/conversation/Model';

function loadFixture(filename: string): Document {
  const filePath = resolve(__dirname, '../fixtures/html', filename);
  const html = readFileSync(filePath, 'utf8');
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('RichContentExtractor Helper Functions', () => {
  it('normalizeText preserves per-line leading indentation', () => {
    const indented = '    indented text';
    expect(normalizeText(indented)).toBe('    indented text');

    const multiline = 'Line 1\n  Line 2 indented';
    expect(normalizeText(multiline)).toBe('Line 1\n  Line 2 indented');
  });

  it('cloneAndSanitizeContent strips buttons, copy UI, scripts, and javascript: links', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <p>Content text</p>
      <button class="copy-code-button">Copy code</button>
      <script>alert("unsafe");</script>
      <a href="javascript:alert(1)">Unsafe link</a>
    `;

    const sanitized = cloneAndSanitizeContent(container);
    expect(sanitized.querySelector('button')).toBeNull();
    expect(sanitized.querySelector('script')).toBeNull();

    const link = sanitized.querySelector('a');
    expect(link?.hasAttribute('href')).toBe(false);
    expect(sanitized.textContent).toContain('Content text');
    expect(sanitized.textContent).not.toContain('Copy code');
  });
});

describe('RichContentExtractor Block Parsers against Combined Fixture', () => {
  const doc = loadFixture('chatgpt-rich-combined.html');
  const assistantTurn = doc.querySelector('[data-message-author-role="assistant"] .markdown.prose');

  it('extracts all block types in strict DOM sequence order', () => {
    expect(assistantTurn).not.toBeNull();
    const blocks = extractContentBlocks(assistantTurn!);

    const blockTypes = blocks.map((b) => b.type);
    expect(blockTypes).toEqual([
      'heading',
      'paragraph',
      'list',
      'code',
      'table',
      'quote',
      'paragraph',
      'math',
      'paragraph',
    ]);
  });

  it('parses Heading block with level 2', () => {
    const blocks = extractContentBlocks(assistantTurn!);
    const heading = blocks[0] as HeadingBlock;

    expect(heading.type).toBe('heading');
    expect(heading.level).toBe(2);
    expect(heading.text).toBe('Overview Guide');
  });

  it('parses Nested List hierarchy recursively without text duplication', () => {
    const blocks = extractContentBlocks(assistantTurn!);
    const list = blocks[2] as ListBlock;

    expect(list.type).toBe('list');
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);

    const item1 = list.items[0];
    expect(item1.text).toBe('Primary Feature');
    expect(item1.children).toBeDefined();
    expect(item1.children?.[0].text).toBe('Sub-feature item 1.1');

    const item2 = list.items[1];
    expect(item2.text).toBe('Secondary Feature');
    expect(item2.children).toBeUndefined();
  });

  it('parses Code block preserving Python language tag and indentation', () => {
    const blocks = extractContentBlocks(assistantTurn!);
    const code = blocks[3] as CodeBlock;

    expect(code.type).toBe('code');
    expect(code.language).toBe('python');
    expect(code.code).toContain('def calculate_sum(a, b):');
    expect(code.code).toContain('    # Indented python function');
    expect(code.code).not.toContain('Copy code');
  });

  it('parses Table block preserving headers and row matrix', () => {
    const blocks = extractContentBlocks(assistantTurn!);
    const table = blocks[4] as TableBlock;

    expect(table.type).toBe('table');
    expect(table.headers).toEqual(['Language', 'Speed', 'Type']);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]).toEqual(['Python', 'Moderate', 'Dynamic']);
    expect(table.rows[1]).toEqual(['C++', 'Fast', 'Static']);
  });

  it('parses Blockquote block', () => {
    const blocks = extractContentBlocks(assistantTurn!);
    const quote = blocks[5] as QuoteBlock;

    expect(quote.type).toBe('quote');
    expect(quote.text).toContain('Simplicity is prerequisite for reliability.');
  });

  it('parses KaTeX Math block extracting LaTeX expression from annotation', () => {
    const blocks = extractContentBlocks(assistantTurn!);
    const math = blocks[7] as MathBlock;

    expect(math.type).toBe('math');
    expect(math.expression).toBe('E = mc^2');
    expect(math.displayMode).toBe(true);
  });
});

describe('Image Parsing', () => {
  it('parses <img> tags into ImageBlock without making network requests', () => {
    const div = document.createElement('div');
    div.innerHTML = '<img src="https://example.com/diagram.png" alt="Architecture Diagram">';

    const blocks = extractContentBlocks(div);
    expect(blocks).toHaveLength(1);

    const img = blocks[0] as ImageBlock;
    expect(img.type).toBe('image');
    expect(img.src).toBe('https://example.com/diagram.png');
    expect(img.alt).toBe('Architecture Diagram');
  });

  it('skips tracking pixels with 1x1 dimensions', () => {
    const div = document.createElement('div');
    div.innerHTML = '<img src="https://example.com/pixel.gif" width="1" height="1">';

    const blocks = extractContentBlocks(div);
    expect(blocks).toHaveLength(0);
  });
});
