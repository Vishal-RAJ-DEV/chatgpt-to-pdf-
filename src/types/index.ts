/**
 * Core type definitions for ChatGPT PDF Exporter
 * Phase 0 Schema Definition
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export type ContentBlockType =
  | 'paragraph'
  | 'heading'
  | 'list'
  | 'code'
  | 'quote'
  | 'table'
  | 'image'
  | 'math';

export interface ParagraphBlock {
  type: 'paragraph';
  html: string;
  text: string;
}

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: string[];
}

export interface CodeBlock {
  type: 'code';
  language: string;
  code: string;
}

export interface QuoteBlock {
  type: 'quote';
  text: string;
}

export interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface ImageBlock {
  type: 'image';
  src: string;
  alt?: string;
}

export interface MathBlock {
  type: 'math';
  expression: string;
  displayMode: boolean;
}

export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | CodeBlock
  | QuoteBlock
  | TableBlock
  | ImageBlock
  | MathBlock;

export interface Message {
  id: string;
  role: MessageRole;
  timestamp?: string;
  blocks: ContentBlock[];
}

export interface Conversation {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  messages: Message[];
}

export interface ExportSettings {
  content: {
    includeUserMessages: boolean;
    includeAssistantMessages: boolean;
    includeTitle: boolean;
    includeDateTime: boolean;
    includeSourceUrl: boolean;
    showSeparators: boolean;
  };
  page: {
    format: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    showPageNumbers: boolean;
  };
  typography: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
  };
  code: {
    fontFamily: string;
    fontSize: number;
    wrapLines: boolean;
  };
  appearance: {
    theme: 'light' | 'dark';
  };
}
