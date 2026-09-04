# Normalized Conversation Domain Model Specification

## 1. Why the Model Exists

The **Normalized Conversation Domain Model** provides a pure, strongly-typed, browser-independent representation of a ChatGPT conversation.

In Chrome Extensions, directly coupling export or rendering logic to web page DOM structures (such as dynamic Tailwind class names or temporary HTML containers) creates brittle code that breaks whenever the website updates its UI.

By establishing an abstract domain model between extraction and rendering, we enforce the core architectural rule:

> **"ChatGPT DOM is NOT the model."**

```
+-------------------+      +-------------------+      +-------------------------+      +-------------------+
|    ChatGPT DOM    | ---> |  ChatGPT Adapter  | ---> | Conversation Extractor  | ---> | DOMAIN MODEL JSON |
+-------------------+      +-------------------+      +-------------------------+      +-------------------+
                                                                                                 |
                                                                                                 v
                                                                                       +-------------------+
                                                                                       | Document Renderer |
                                                                                       +-------------------+
                                                                                                 |
                                                                                                 v
                                                                                       +-------------------+
                                                                                       |   PDF Export UI   |
                                                                                       +-------------------+
```

---

## 2. Architectural Boundaries & Guarantees

The domain model (`src/core/conversation/Model.ts`) guarantees:
1. **Zero DOM Dependencies**: Contains **no** `HTMLElement`, `Document`, `Window`, or Chrome Extension runtime API references.
2. **Immutability**: All interfaces and array properties use TypeScript `readonly` modifiers to prevent accidental mutation across rendering pipeline stages.
3. **Pure Serialization**: Guaranteed safe JSON serialization via `JSON.stringify(conversation)` (zero circular references, functions, or DOM nodes).
4. **Environment Agnostic**: Usable in pure Node.js, Vitest unit test suites, CLI tools, or browser execution contexts.

---

## 3. Conversation Structure

```typescript
export interface Conversation {
  readonly id: string | null;       // UUID from URL (/c/{id}) or null if unsaved
  readonly title: string;           // Conversation title string
  readonly url: string;             // Source URL (e.g. "https://chatgpt.com/c/...")
  readonly createdAt?: string;      // ISO 8601 creation timestamp string
  readonly messages: readonly Message[];
  readonly metadata?: ExtractionMetadata;
}
```

---

## 4. Message Structure

```typescript
export type MessageRole = 'user' | 'assistant' | 'system' | 'unknown';

export interface Message {
  readonly id: string;               // Unique turn identifier
  readonly role: MessageRole;        // Turn author role
  readonly timestamp?: string;       // Optional timestamp string
  readonly blocks: readonly ContentBlock[]; // Discriminated union of content blocks
}
```

---

## 5. ContentBlock Discriminated Union Variants

Every block inside a message turn implements a discriminated union keyed by `type`:

### 5.1 Paragraph Block (`type: 'paragraph'`)
Contains standard body paragraph text:
```json
{
  "type": "paragraph",
  "text": "Here is how you write a Hello World program in Python:"
}
```

### 5.2 Heading Block (`type: 'heading'`)
Represents section headings (`H1` through `H6`):
```json
{
  "type": "heading",
  "level": 2,
  "text": "Key Features"
}
```

### 5.3 Code Block (`type: 'code'`)
Preserves preformatted raw code, indentation, and optional language tag:
```json
{
  "type": "code",
  "language": "python",
  "code": "def fibonacci(n):\n    if n <= 0:\n        return 0\n    return n"
}
```

### 5.4 List Block & Recursive List Items (`type: 'list'`)
Supports ordered or unordered lists with recursive `ListItem` children to preserve sub-bullet nesting:
```json
{
  "type": "list",
  "ordered": false,
  "items": [
    {
      "text": "First bullet item",
      "children": [
        {
          "text": "Nested sub-bullet item"
        }
      ]
    }
  ]
}
```

### 5.5 Quote Block (`type: 'quote'`)
Represents blockquote citations:
```json
{
  "type": "quote",
  "text": "Knowledge is power."
}
```

### 5.6 Table Block (`type: 'table'`)
Preserves table headers and row matrixes:
```json
{
  "type": "table",
  "headers": ["Feature", "Python", "JavaScript"],
  "rows": [
    ["Type System", "Dynamic, Strong", "Dynamic, Weak"],
    ["Runtime", "CPython", "V8 / Node.js"]
  ]
}
```
*Note*: If a row contains fewer items than `headers.length`, missing items are represented as `""`.

### 5.7 Image Block (`type: 'image'`)
Represents image references without downloading external assets:
```json
{
  "type": "image",
  "src": "https://chatgpt.com/images/sample.png",
  "alt": "Sample Diagram"
}
```

### 5.8 Math Block (`type: 'math'`)
Represents LaTeX / KaTeX mathematical expressions:
```json
{
  "type": "math",
  "expression": "E = mc^2",
  "displayMode": true
}
```

---

## 6. Representative JSON Example

```json
{
  "id": "672a1b9e-4c80-8005-9f5b-123456789abc",
  "title": "Python Guide",
  "url": "https://chatgpt.com/c/672a1b9e-4c80-8005-9f5b-123456789abc",
  "createdAt": "2026-09-04T10:00:00Z",
  "messages": [
    {
      "id": "conversation-turn-1",
      "role": "user",
      "blocks": [
        {
          "type": "paragraph",
          "text": "How do I write a Hello World in Python?"
        }
      ]
    },
    {
      "id": "conversation-turn-2",
      "role": "assistant",
      "blocks": [
        {
          "type": "paragraph",
          "text": "Here is a simple Python program:"
        },
        {
          "type": "code",
          "language": "python",
          "code": "print(\"Hello, World!\")"
        }
      ]
    }
  ],
  "metadata": {
    "source": "chatgpt.com",
    "extractedAt": "2026-09-04T10:15:00.000Z",
    "adapterVersion": "0.1.0",
    "confidence": "high"
  }
}
```

---

## 7. How the Extractor and Renderer Consume the Model

1. **DOM Extractor (Producer)**:
   - Traverses ChatGPT DOM elements (`article`, `.markdown.prose`).
   - Converts raw HTML nodes into pure `ContentBlock` variants.
   - Instantiates a clean `Conversation` object.
2. **Document Renderer (Consumer)**:
   - Accepts a `Conversation` object + user `ExportSettings`.
   - Iterates over `messages` and `blocks` to generate styled HTML for PDF printing.
   - Operates with **zero knowledge** of ChatGPT's DOM structure.

---

## 8. Data Intentionally Excluded

To keep the core model clean and secure, the following elements are strictly excluded:
- `HTMLElement` / `Node` object references.
- Raw unparsed HTML strings from ChatGPT.
- Temporary UI controls (Copy code buttons, Thumbs up/down icons, Edit prompt forms, Branch switchers).
- Class names (e.g. Tailwind `dark:prose-invert`, `py-2`).

---

## 9. Future Extension Strategy

When new content types are introduced in future ChatGPT releases (e.g. interactive artifacts or canvas widgets):
1. Extend `ContentBlockType` union with the new type string (e.g. `'artifact'`).
2. Add the corresponding `ArtifactBlock` interface to `Model.ts`.
3. Add a case in renderer components to render the new block type.
4. Existing renderers and extractors will continue to operate safely due to TypeScript discriminated union exhaustiveness checks.
