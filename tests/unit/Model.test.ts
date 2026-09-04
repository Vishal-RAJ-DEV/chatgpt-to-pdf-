import { describe, it, expect } from 'vitest';
import {
  Conversation,
  Message,
  ContentBlock,
  ParagraphBlock,
  HeadingBlock,
  CodeBlock,
  ListBlock,
  QuoteBlock,
  TableBlock,
  ImageBlock,
  MathBlock,
  isContentBlock,
  isMessage,
  isConversation,
} from '../../src/core/conversation/Model';

describe('Normalized Conversation Domain Model', () => {
  it('constructs a valid Conversation object with null conversation ID', () => {
    const conversation: Conversation = {
      id: null,
      title: 'New Unsaved Chat',
      url: 'https://chatgpt.com/',
      messages: [],
    };

    expect(conversation.id).toBeNull();
    expect(conversation.title).toBe('New Unsaved Chat');
    expect(conversation.messages).toHaveLength(0);
  });

  it('supports all 8 ContentBlock discriminated union variants', () => {
    const paragraph: ParagraphBlock = { type: 'paragraph', text: 'Hello paragraph' };
    const heading: HeadingBlock = { type: 'heading', level: 1, text: 'Title Heading' };
    const code: CodeBlock = { type: 'code', code: 'print("hello")', language: 'python' };
    const list: ListBlock = {
      type: 'list',
      ordered: false,
      items: [{ text: 'Item 1', children: [{ text: 'Nested Sub-item 1' }] }],
    };
    const quote: QuoteBlock = { type: 'quote', text: 'A wise quote' };
    const table: TableBlock = {
      type: 'table',
      headers: ['Col 1', 'Col 2'],
      rows: [['Cell 1', 'Cell 2']],
    };
    const image: ImageBlock = { type: 'image', src: 'https://example.com/img.png', alt: 'Sample' };
    const math: MathBlock = { type: 'math', expression: 'E=mc^2', displayMode: true };

    const blocks: ContentBlock[] = [
      paragraph,
      heading,
      code,
      list,
      quote,
      table,
      image,
      math,
    ];

    expect(blocks).toHaveLength(8);
    expect(blocks.map((b) => b.type)).toEqual([
      'paragraph',
      'heading',
      'code',
      'list',
      'quote',
      'table',
      'image',
      'math',
    ]);
  });

  it('preserves nested recursive list structures in ListBlock', () => {
    const listBlock: ListBlock = {
      type: 'list',
      ordered: true,
      items: [
        {
          text: 'Parent Item 1',
          children: [
            {
              text: 'Child Item 1.1',
              children: [{ text: 'Grandchild Item 1.1.1' }],
            },
          ],
        },
      ],
    };

    expect(listBlock.items[0].text).toBe('Parent Item 1');
    expect(listBlock.items[0].children?.[0].text).toBe('Child Item 1.1');
    expect(listBlock.items[0].children?.[0].children?.[0].text).toBe('Grandchild Item 1.1.1');
  });

  it('serializes and deserializes to JSON cleanly without DOM or circular references', () => {
    const conversation: Conversation = {
      id: '672a1b9e-4c80-8005-9f5b-123456789abc',
      title: 'JSON Serialization Test',
      url: 'https://chatgpt.com/c/672a1b9e-4c80-8005-9f5b-123456789abc',
      createdAt: '2026-09-04T10:00:00Z',
      messages: [
        {
          id: 'turn-1',
          role: 'user',
          blocks: [{ type: 'paragraph', text: 'Prompt text' }],
        },
        {
          id: 'turn-2',
          role: 'assistant',
          blocks: [{ type: 'code', code: 'console.log("hello");', language: 'javascript' }],
        },
      ],
      metadata: {
        source: 'chatgpt.com',
        extractedAt: '2026-09-04T10:15:00Z',
        adapterVersion: '0.1.0',
        confidence: 'high',
      },
    };

    const jsonString = JSON.stringify(conversation);
    const parsed = JSON.parse(jsonString) as Conversation;

    expect(parsed.id).toBe(conversation.id);
    expect(parsed.title).toBe(conversation.title);
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.messages[1].blocks[0]).toEqual({
      type: 'code',
      code: 'console.log("hello");',
      language: 'javascript',
    });
  });

  it('validates type guards for isContentBlock, isMessage, and isConversation', () => {
    const validBlock: ParagraphBlock = { type: 'paragraph', text: 'Valid text' };
    const invalidBlock = { type: 'unknown_block', data: 123 };

    expect(isContentBlock(validBlock)).toBe(true);
    expect(isContentBlock(invalidBlock)).toBe(false);

    const validMsg: Message = {
      id: 'msg-1',
      role: 'assistant',
      blocks: [validBlock],
    };
    const invalidMsg = { id: 'msg-2', role: 'invalid_role', blocks: [] };

    expect(isMessage(validMsg)).toBe(true);
    expect(isMessage(invalidMsg)).toBe(false);

    const validConv: Conversation = {
      id: 'conv-1',
      title: 'Valid Conv',
      url: 'https://chatgpt.com/c/conv-1',
      messages: [validMsg],
    };
    const invalidConv = { id: 123, title: 456 };

    expect(isConversation(validConv)).toBe(true);
    expect(isConversation(invalidConv)).toBe(false);
  });
});
