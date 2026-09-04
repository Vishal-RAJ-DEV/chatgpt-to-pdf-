# Plain ChatGPT Conversation Extraction Specification

## 1. Overview & Architecture Pipeline

The **Conversation Extractor** (`src/core/conversation/Extractor.ts`) is responsible for consuming DOM nodes discovered by `ChatGPTAdapter` and transforming them into a normalized `Conversation` domain model object (`src/core/conversation/Model.ts`).

```
+---------------------+      +---------------------+      +------------------------+      +-------------------+
|     ChatGPT DOM     | ---> |   ChatGPT Adapter   | ---> | Conversation Extractor | ---> | Conversation Model|
| (https://chatgpt.com) |      | (selectors registry)|      | (text normalization)   |      | (pure JSON model) |
+---------------------+      +---------------------+      +------------------------+      +-------------------+
```

---

## 2. Separation of Responsibilities

To ensure codebase longevity and resilience against ChatGPT front-end updates:

| Layer | Permitted Responsibilities | Strict Prohibitions |
| :--- | :--- | :--- |
| **ChatGPT Adapter** | CSS / `data-*` selectors, DOM query methods (`findConversationRoot`, `findTurnCandidates`, `getRoleFromElement`, `findContentRoot`, `getConversationTitle`, `getConversationId`, `isStreaming`). | MUST NOT construct domain `Conversation` models, format text, or handle rendering. |
| **Conversation Extractor** | Text normalization, UI element stripping, deterministic ID generation, empty turn handling, streaming protection, confidence scoring. | MUST NOT contain hardcoded ChatGPT CSS/data-attribute selectors. |
| **Domain Model** | Pure TypeScript interface contracts and type guards (`isConversation`, `isMessage`). | MUST NOT contain DOM node references or Chrome Extension API calls. |

---

## 3. Deterministic Message ID Strategy

To ensure reproducible extraction results without relying on non-deterministic random IDs, message turn IDs are resolved in the following priority:

1. **`data-message-id` Attribute**: `turnElement.getAttribute('data-message-id')` if present.
2. **`data-testid` Attribute**: `turnElement.getAttribute('data-testid')` if present (e.g. `conversation-turn-1`).
3. **Index Fallback**: `turn-{index + 1}` based on zero-indexed position in `findTurnCandidates()`.

*Rule*: `Math.random()` and timestamps alone are strictly prohibited for ID generation.

---

## 4. Role Extraction & Unknown Role Policy

- Turn author roles are resolved via `getRoleFromElement(turnElement)`.
- Valid roles: `'user' | 'assistant' | 'system' | 'unknown'`.
- **Unknown Role Policy**: If a turn's author role cannot be determined, it is recorded with `role: 'unknown'`. The extractor does **not** crash or silently convert unknown turns into assistant messages.

---

## 5. Text Normalization Rules (`normalizeText`)

Text extracted from content roots undergoes standardized normalization:
1. **Newline Normalization**: Converts all Windows `\r\n` and Mac `\r` line endings to standard Unix `\n`.
2. **Outer Trimming**: Trims leading and trailing whitespace from the string.
3. **Blank Line Collapsing**: Collapses 3 or more consecutive newlines (`\n\n\n+`) down to 2 newlines (`\n\n`).
4. **Multiline Preservation**: Single newlines within multiline user prompts or assistant turns are strictly preserved.

---

## 6. UI Text Control Exclusion (`extractCleanText`)

To prevent toolbar UI labels from leaking into extracted message paragraphs, the extractor clones the content root element and strips the following nodes before reading `textContent`:
- `<button>` elements
- Copy buttons (`.copy-code-button`, `[aria-label*="Copy"]`)
- Edit buttons (`[aria-label*="Edit"]`)
- Code block header bar subtrees

---

## 7. Empty Message Handling

- If a turn element exists but its content root is missing or empty, the extractor produces a valid `Message` with `blocks: []` (empty array).
- This preserves the turn count and author sequence without inventing dummy placeholder text.

---

## 8. Streaming Protection (`isStreaming`)

- Before extraction begins, `extractConversation()` checks `isStreaming(root)`.
- If an assistant turn is actively streaming (`.result-streaming` present), extraction aborts immediately by throwing a typed `ExtractionError`:
  ```typescript
  throw new ExtractionError(
    'STREAMING_IN_PROGRESS',
    'Conversation response is currently generating. Please wait for streaming to complete.'
  );
  ```
- **Error Privacy Guarantee**: `ExtractionError` messages never include extracted prompt or response text.

---

## 9. Extraction Confidence Scoring

`Conversation.metadata.confidence` is computed based on DOM health indicators:
- **`high`**: Conversation container detected, valid turn candidates found, and both user and assistant roles identified.
- **`medium`**: Turns found, but some author roles are `'unknown'` or container fallback was used.
- **`low`**: No turns found or critical container discovery failed.

---

## 10. Privacy & Zero-Log Policy

- Extractor logs (`logger.info`) record only quantitative metrics (e.g. `turns=4`, `unknownRoles=0`, `confidence=high`).
- Private user prompt text and assistant response text are **never logged** to console or persisted in diagnostic logs.

---

## 11. Deferral of Rich Content Parsing (Phase 3C)

In Phase 3B, all message turns are extracted as plain text paragraph blocks (`type: 'paragraph'`).

The following rich content block parsers are intentionally deferred to Phase 3C:
- Markdown Code Blocks (`<pre><code>`) -> `CodeBlock`
- HTML Tables (`<table>`) -> `TableBlock`
- Headings (`<h1>` - `<h6>`) -> `HeadingBlock`
- Nested Lists (`<ul>`, `<ol>`) -> `ListBlock`
- Blockquotes (`<blockquote>`) -> `QuoteBlock`
- Math Formulas (KaTeX) -> `MathBlock`
