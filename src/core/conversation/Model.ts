/**
 * Normalized Conversation Domain Model — Phase 3A.
 *
 * Pure, browser-independent TypeScript definitions representing a ChatGPT conversation.
 * Completely decoupled from browser DOM APIs (HTMLElement, Document), Chrome Extension APIs,
 * CSS styling, PDF generation, or selector logic.
 *
 * Immutability: All interfaces use `readonly` properties to prevent accidental mutation.
 */

export type MessageRole = 'user' | 'assistant' | 'system' | 'unknown';

export type ContentBlockType =
  | 'paragraph'
  | 'heading'
  | 'code'
  | 'list'
  | 'quote'
  | 'table'
  | 'image'
  | 'math';

/**
 * Paragraph block containing semantic text content.
 */
export interface ParagraphBlock {
  readonly type: 'paragraph';
  readonly text: string;
}

/**
 * Heading block with level (1 to 6) and text content.
 */
export interface HeadingBlock {
  readonly type: 'heading';
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly text: string;
}

/**
 * Code block preserving raw code text, indentation, and optional language tag.
 */
export interface CodeBlock {
  readonly type: 'code';
  readonly code: string;
  readonly language?: string;
}

/**
 * Recursive list item to represent nested lists cleanly.
 */
export interface ListItem {
  readonly text: string;
  readonly children?: readonly ListItem[];
}

/**
 * List block supporting ordered or unordered item hierarchies.
 */
export interface ListBlock {
  readonly type: 'list';
  readonly ordered: boolean;
  readonly items: readonly ListItem[];
}

/**
 * Blockquote block.
 */
export interface QuoteBlock {
  readonly type: 'quote';
  readonly text: string;
}

/**
 * Table block preserving header array and row matrix.
 * Note: If a row has fewer cells than headers, missing cells are padded as "".
 */
export interface TableBlock {
  readonly type: 'table';
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/**
 * Image block representing an embedded image reference.
 */
export interface ImageBlock {
  readonly type: 'image';
  readonly src: string;
  readonly alt?: string;
}

/**
 * Math block representing KaTeX / LaTeX formulas.
 */
export interface MathBlock {
  readonly type: 'math';
  readonly expression: string;
  readonly displayMode: boolean;
}

/**
 * Discriminated union of all supported content block variants.
 */
export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | CodeBlock
  | ListBlock
  | QuoteBlock
  | TableBlock
  | ImageBlock
  | MathBlock;

/**
 * Diagnostic metadata collected during extraction.
 * Kept strictly separated from conversation content.
 */
export interface ExtractionMetadata {
  readonly source: string;
  readonly extractedAt: string;
  readonly adapterVersion: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly completeness?: 'complete' | 'uncertain';
}

/**
 * Individual message turn in a conversation session.
 */
export interface Message {
  readonly id: string;
  readonly role: MessageRole;
  readonly timestamp?: string;
  readonly blocks: readonly ContentBlock[];
}

/**
 * Complete normalized conversation session.
 */
export interface Conversation {
  readonly id: string | null;
  readonly title: string;
  readonly url: string;
  readonly createdAt?: string;
  readonly messages: readonly Message[];
  readonly metadata?: ExtractionMetadata;
}

/* ==========================================================================
   Type Guard Validation Helpers
   ========================================================================== */

/**
 * Type guard for checking if a value is a valid ContentBlock.
 */
export function isContentBlock(value: unknown): value is ContentBlock {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const validTypes: ContentBlockType[] = [
    'paragraph',
    'heading',
    'code',
    'list',
    'quote',
    'table',
    'image',
    'math',
  ];
  return typeof candidate.type === 'string' && validTypes.includes(candidate.type as ContentBlockType);
}

/**
 * Type guard for checking if a value is a valid Message.
 */
export function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const validRoles: MessageRole[] = ['user', 'assistant', 'system', 'unknown'];
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.role === 'string' &&
    validRoles.includes(candidate.role as MessageRole) &&
    Array.isArray(candidate.blocks) &&
    candidate.blocks.every(isContentBlock)
  );
}

/**
 * Type guard for checking if a value is a valid Conversation.
 */
export function isConversation(value: unknown): value is Conversation {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.id === null || typeof candidate.id === 'string') &&
    typeof candidate.title === 'string' &&
    typeof candidate.url === 'string' &&
    Array.isArray(candidate.messages) &&
    candidate.messages.every(isMessage)
  );
}
