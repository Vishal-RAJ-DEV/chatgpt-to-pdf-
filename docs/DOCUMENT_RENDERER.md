# Document Renderer Specification

## 1. Overview & Architectural Boundaries

The **Document Renderer** (`src/core/renderer/DocumentRenderer.ts`) is a pure, deterministic rendering engine responsible for transforming a normalized `Conversation` domain model object into a complete, standalone, printable HTML document string.

```
+---------------------------+      +---------------------------+      +-------------------------------+
| Normalized Conversation   | ---> |     Document Renderer     | ---> | Standalone Printable HTML     |
| (Model.ts JSON contract)  |      | (security escaping + CSS) |      | (<!doctype html>...</html>)   |
+---------------------------+      +---------------------------+      +-------------------------------+
                                                                                      |
                                                                                      v
                                                                           +---------------------+
                                                                           | Local Browser Print |
                                                                           | (Phase 6 PDF Engine)|
                                                                           +---------------------+
```

### Strict Architectural Guarantees
1. **Zero ChatGPT DOM Dependencies**: Contains **no** `ChatGPTAdapter`, CSS selectors, or `data-testid` queries.
2. **Zero Chrome API Dependencies**: Contains **no** `chrome.storage` or `chrome.runtime` calls.
3. **Zero Network Activity**: Performs **no** `fetch()` requests or remote image asset downloads.
4. **Immutability**: Source `Conversation` model instances are never mutated.
5. **100% Security Escaping**: All untrusted strings are escaped to prevent XSS. Dangerous URL schemes (`javascript:`, `vbscript:`, `data:text/html`) are strictly rejected.

---

## 2. API Contract

```typescript
import { Conversation } from '../conversation/Model';
import { RenderOptions } from './RenderTypes';

export function renderConversation(
  conversation: Conversation,
  options?: Partial<RenderOptions>
): string;
```

---

## 3. RenderOptions Schema & Defaults

```typescript
export interface RenderOptions {
  pageSize: 'A4' | 'LETTER';
  orientation: 'portrait' | 'landscape';
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;

  fontFamily: string;
  baseFontSize: string;
  lineHeight: number;

  showConversationTitle: boolean;
  showDate: boolean;
  showUserMessages: boolean;
  showAssistantMessages: boolean;
  showFooterPageNumbers: boolean;

  codeTheme: 'light' | 'dark';
  headingSpacing: boolean;
}
```

### Default Values (`DEFAULT_RENDER_OPTIONS`)
- `pageSize`: `'A4'`
- `orientation`: `'portrait'`
- Margins: `'18mm'` (top, right, bottom, left)
- `fontFamily`: System sans-serif stack (`-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`)
- `baseFontSize`: `'10pt'`
- `lineHeight`: `1.5`
- `showConversationTitle`: `true`
- `showDate`: `true`
- `showUserMessages`: `true`
- `showAssistantMessages`: `true`
- `showFooterPageNumbers`: `true`
- `codeTheme`: `'dark'`

---

## 4. Content Block Rendering Mappings

| `ContentBlock` Discriminator | Generated HTML Element | Processing & Styling Rules |
| :--- | :--- | :--- |
| `paragraph` | `<p>` | HTML-escaped text wrapping. |
| `heading` | `<h1 level="1..6">` | HTML-escaped text. Applied CSS `break-after: avoid;` to prevent orphaned headings. |
| `code` | `<div class="code-wrapper"><pre><code class="language-{lang}">...</code></pre></div>` | HTML-escaped code text. **Raw indentation and line breaks preserved**. No copy buttons. |
| `list` | `<ol>` / `<ul>` | Recursive `ListItem` rendering (`<li>` and nested `<ul>`/`<ol>`). |
| `quote` | `<blockquote>` | Left border accent (`3px solid #3B82F6`) with italicized text. |
| `table` | `<table>` | `<thead>` headers + `<tbody>` row matrix. HTML-escaped cell content. Uneven rows padded with `""`. |
| `image` | `<img src="{safeUrl}" alt="{safeAlt}" />` | Responsive styling (`max-width: 100%; height: auto;`). Safe URL validation. |
| `math` | `<div class="math-block math-display">` | KaTeX LaTeX formula text HTML-escaped. |
| Unknown fallback | `<p class="fallback-block">` | JSON-stringified fallback paragraph. |

---

## 5. Security & Escaping Rules

### String Escaping (`escapeHtml`)
All string properties from `Conversation` and `ContentBlock` are escaped before template insertion:
- `&` -> `&amp;`
- `<` -> `&lt;`
- `>` -> `&gt;`
- `"` -> `&quot;`
- `'` -> `&#39;`

### URL Sanitization (`sanitizeUrl`)
- Protocols starting with `javascript:`, `vbscript:`, or `data:text/html` return an empty string (`""`).

---

## 6. CSS Print & Layout Strategy

- `@page` rule specifies page size (`A4` or `Letter`), orientation, and configurable margins.
- Page Break Protection: Applied `break-inside: avoid;` to message cards (`.message`), code blocks (`.code-wrapper`), tables (`.table-wrapper`), blockquotes (`blockquote`), and math blocks (`.math-block`).
- Headings use `break-after: avoid;` to keep section titles together with following paragraphs.

---

## 7. Deferral to Future Phases

- **Phase 5**: Settings storage interface will connect user options to `RenderOptions`.
- **Phase 6**: Browser Local Print engine (`window.print()`) will render the output HTML string.
