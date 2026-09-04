# Rich Content Extraction Engine Specification

## 1. Overview & Architecture

The **Rich Content Extraction Engine** (`src/core/conversation/RichContentExtractor.ts`) traverses DOM subtrees inside ChatGPT content roots, recognizes semantic HTML structure, and converts DOM nodes into a typed array of `ContentBlock` objects.

```
+------------------------+      +--------------------------+      +-------------------------+
|   ChatGPT Content Root | ---> | cloneAndSanitizeContent  | ---> | extractContentBlocks    |
|   (.markdown.prose)    |      | (non-mutating UI strip)  |      | (single-pass traversal) |
+------------------------+      +--------------------------+      +-------------------------+
                                                                               |
                                                                               v
                                                                    +----------------------+
                                                                    |   ContentBlock[]     |
                                                                    | (paragraph, heading, |
                                                                    |  code, list, table,  |
                                                                    |  quote, image, math) |
                                                                    +----------------------+
```

---

## 2. DOM Node to ContentBlock Mapping Matrix

| HTML Tag / DOM Element | Primary Selector | Target `ContentBlock` Type | Notes / Processing Rules |
| :--- | :--- | :--- | :--- |
| `<p>` | `p` | `ParagraphBlock` | Preserves inline text, links, and bold/italic formatting. |
| `<h1>` - `<h6>` | `h1`..`h6` | `HeadingBlock` | Maps tag name level (`level: 1..6`). |
| `<pre><code>` / `<pre>` | `pre` | `CodeBlock` | **Raw code text is preserved 100% untouched** (indentation & line breaks). Bypasses line trimming. Detects `language-{lang}` class. |
| `<ul>` / `<ol>` | `ul`, `ol` | `ListBlock` | Recursive `ListItem` parsing (`children: ListItem[]`). Preserves list nesting without text duplication. |
| `<blockquote>` | `blockquote` | `QuoteBlock` | Multiline quote text content. |
| `<table>` | `table` | `TableBlock` | Extracts `<th>` headers and `<td>` row matrix. Handles empty cells and pads uneven rows. |
| `<img>` | `img` | `ImageBlock` | Extracts `src` and `alt`. Skips 1x1 tracking pixels. **Zero network calls**. |
| `.katex` / `.katex-display` | `.katex`, `.katex-display` | `MathBlock` | Recovers raw LaTeX expression from `<annotation encoding="application/x-tex">` or `alttext`. |
| Unmapped `<div>` / `<span>` | Generic wrapper | `ParagraphBlock` fallback | Extracts text content if non-empty; otherwise recurses child elements. |

---

## 3. Key Design Strategies

### 3.1 Strict DOM Sequence Order Preservation
`extractContentBlocks()` traverses top-level DOM nodes in their natural document order. Content block sequences strictly match the rendered output (e.g. `Heading` -> `Paragraph` -> `List` -> `Code` -> `Table` -> `Quote` -> `Math` -> `Paragraph`).

### 3.2 Code Block Indentation & Whitespace Protection
Unlike plain paragraph text, code blocks bypass string normalizers completely. Indentation spaces, tab formatting, and blank lines inside `<code>` subtrees are preserved character-for-character.

### 3.3 List Recursion & Parent Text Isolation
When traversing `<li>` items, sub-lists (`<ul>`/`<ol>`) are removed from a cloned item node before reading text. Sub-list items are recursively parsed into `ListItem.children`, preventing parent bullet text from containing child bullet text.

### 3.4 Table Matrix Extraction & Uneven Row Padding
Headers (`<th>`) and rows (`<tr>` -> `<td>`) are parsed natively from HTML table elements. If a row contains fewer cells than headers, missing cells are padded as `""`.

### 3.5 KaTeX Math Recovery
Mathematical formulas are recovered by inspecting:
1. `<annotation encoding="application/x-tex">` text.
2. `alttext` or `data-expr` attributes.
3. Fallback text content.

### 3.6 Non-Mutating UI Sanitization & Security
- Content roots are cloned (`cloneNode(true)`) before parsing so live page DOM is never mutated.
- Non-content UI controls (`button`, `.copy-code-button`, edit icons, header bars) are removed from the cloned tree before reading text.
- Security: `<script>`, `<iframe>`, `<object>`, `<embed>` tags, `on*` inline event handlers, and `javascript:` URLs are stripped.

### 3.7 Performance Strategy
Traversal uses a single-pass O(n) child node iteration over the cloned tree. No repeated full-document `querySelectorAll()` loops are performed.

---

## 4. Unsupported Cases & Future Enhancements

- **Interactive Canvas / WebGL Widgets**: Rendered canvas graphics cannot be extracted as pure text blocks.
- **External Image Downloads**: Image URLs are preserved as strings; remote images are not downloaded or converted to base64 in this phase.
