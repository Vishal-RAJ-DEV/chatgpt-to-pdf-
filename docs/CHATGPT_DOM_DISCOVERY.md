# ChatGPT DOM Discovery & Adapter Reconnaissance Specification

## Executive Summary

This document details the DOM reconnaissance and structural discovery performed on the current **ChatGPT** web application (`https://chatgpt.com`). It serves as the evidence-based reference specification for the `ChatGPTAdapter` module, establishing selector hierarchies, confidence levels, DOM edge cases, and a standardized maintenance strategy.

---

## 1. Environment & Inspection Metadata

- **Target Host**: `https://chatgpt.com`
- **Inspection Date**: September 4, 2026
- **Operating Environment**: Google Chrome (Chromium V3 Extension Runtime)
- **DOM Architecture**: Single-Page React Application (Next.js client-side rendering with Tailwind CSS classes).

---

## 2. ChatGPT URL Patterns

| URL Pattern | Context / State | Extracted Conversation ID |
| :--- | :--- | :--- |
| `https://chatgpt.com/` | New / Unsaved Conversation Session | `null` |
| `https://chatgpt.com/c/{uuid}` | Standard Saved Conversation | `{uuid}` (e.g., `672a1b9e-4c80-8005-9f5b-123456789abc`) |
| `https://chatgpt.com/g/{g-id}/c/{uuid}` | Custom GPT Conversation | `{uuid}` |

### Extraction Regex Pattern
```typescript
const idMatch = window.location.pathname.match(/\/c\/([a-f0-9-]+)/i);
const conversationId = idMatch ? idMatch[1] : null;
```

---

## 3. Main Conversation Container Discovery

ChatGPT encapsulates all rendered message turns inside a dedicated vertical flex layout container inside the main landmark.

- **Primary Selector**: `[data-testid="conversation-turns-container"]` (Confidence: **HIGH**)
- **Secondary Fallback**: `main .flex-1.overflow-hidden` (Confidence: **MEDIUM**)
- **Structural Fallback**: `main` (Confidence: **LOW**)

### Structural Characteristics
- Remains mounted in the DOM during SPA conversation switches.
- Child nodes are updated dynamically when switching between chats or submitting new prompts.

---

## 4. User Turn DOM Structure

A user message turn represents a prompt submitted by the user.

- **Turn Root Selector**: `article[data-testid^="conversation-turn-"]` where `data-message-author-role="user"` (Confidence: **HIGH**).
- **Content Wrapper Selector**: `.user-message-content` or `.whitespace-pre-wrap` (Confidence: **HIGH**).

### Subtree Breakdown
```html
<article data-testid="conversation-turn-1" data-message-author-role="user">
  <div class="py-2 flex m-auto text-base gap-4 md:gap-6 md:max-w-2xl lg:max-w-xl xl:max-w-3xl">
    <div class="relative flex w-full min-w-0 flex-col">
      <!-- Content Root -->
      <div class="user-message-content whitespace-pre-wrap">How do I write a Hello World in Python?</div>
    </div>
  </div>
</article>
```

### UI Controls & Exclusion
- User edit buttons, copy buttons, and turn branch selectors live in adjacent control subtrees (`button[aria-label="Edit prompt"]`). They must be excluded by targeting `.user-message-content` directly.

---

## 5. Assistant Turn DOM Structure

An assistant message turn contains the rendered AI output.

- **Turn Root Selector**: `article[data-testid^="conversation-turn-"]` where `data-message-author-role="assistant"` (Confidence: **HIGH**).
- **Content Root Selector**: `.markdown.prose` (Confidence: **HIGH**).

### Subtree Breakdown
```html
<article data-testid="conversation-turn-2" data-message-author-role="assistant">
  <div class="py-2 flex m-auto text-base gap-4 md:gap-6 md:max-w-2xl lg:max-w-xl xl:max-w-3xl">
    <div class="relative flex w-full min-w-0 flex-col">
      <div class="agent-turn">
        <!-- Content Root -->
        <div class="markdown prose w-full break-words dark:prose-invert light">
          <p>Here is how you write a Hello World program in Python:</p>
        </div>
      </div>
    </div>
  </div>
</article>
```

---

## 6. Message Identity & Ordering

### Message Identification
- **Turn Attribute**: `data-testid="conversation-turn-{N}"` where `{N}` is a 1-based index representing the turn sequence.
- **Message ID Attribute**: `data-message-id` (present on select message wrappers).
- **Fallback**: Zero-based array index of turn elements inside the conversation container.

### Message Ordering
- DOM node sequence inside `[data-testid="conversation-turns-container"]` strictly corresponds to conversation chronological order.

---

## 7. Content Root Mapping

| Author Role | Target Content Root Selector | Fallback Selector |
| :--- | :--- | :--- |
| `user` | `.user-message-content` | `.whitespace-pre-wrap` |
| `assistant` | `.markdown.prose` | `.agent-turn .prose`, `.prose` |

---

## 8. Code Block Structure & UI Exclusion

### DOM Representation
```html
<div class="bg-black rounded-md">
  <!-- Header / Action Bar (EXCLUDE TEXT FROM CONTENT) -->
  <div class="flex items-center justify-between px-4 py-1.5 text-xs text-gray-200 bg-gray-800">
    <span>python</span>
    <button class="copy-code-button">Copy code</button>
  </div>
  <!-- Code Body -->
  <div class="p-4 overflow-y-auto">
    <pre><code class="language-python">print("Hello, World!")</code></pre>
  </div>
</div>
```

### Extraction Strategy
1. Locate `<pre>` element or `<code class="language-*">`.
2. Extract language identifier string from `span` inside header or `class="language-{lang}"`.
3. Extract raw text from `<code>` node **only**.
4. **Exclude** the `button.copy-code-button` text to prevent "Copy code" strings from leaking into PDF exports.

---

## 9. Table Structure & HTML Semantics

ChatGPT renders markdown tables using standard HTML table markup:
- Root: `<table>`
- Header: `<thead>` -> `<tr>` -> `<th>`
- Body: `<tbody>` -> `<tr>` -> `<td>`

### Semantic Integrity
HTML table semantics are 100% native. The extractor can directly parse headers and cell matrixes without needing custom regex parsers.

---

## 10. Rich Content Formatting Elements

Inside `.markdown.prose`, ChatGPT renders standard HTML5 tags:
- **Headings**: `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>`, `<h6>`
- **Paragraphs**: `<p>`
- **Lists**: `<ul>`, `<ol>`, `<li>`
- **Inline Formatting**: `<strong>`, `<em>`, `<code>`
- **Blockquotes**: `<blockquote>`
- **Math / Formulas**: Rendered via KaTeX inside `<span class="katex-display">` or `<span class="katex">`
- **Links**: `<a href="..." target="_blank">`

---

## 11. Conversation Title Discovery Strategy

To name the exported PDF document cleanly, the title is resolved using the following priority:

1. **Document Title**: `document.title` stripped of `- ChatGPT` suffix (e.g., `"Python Fibonacci Script - ChatGPT"` -> `"Python Fibonacci Script"`). (Confidence: **HIGH**)
2. **Main Header**: `main h1` text content inside active conversation view. (Confidence: **MEDIUM**)
3. **Fallback Default**: `"ChatGPT Conversation"`.

---

## 12. SPA Navigation Behavior

- Navigation between conversations uses React client-side routing (`history.pushState`).
- Tab reloads do **not** occur.
- The `[data-testid="conversation-turns-container"]` element remains mounted while child turn nodes are unmounted and replaced.
- Extension observers must monitor DOM updates or URL changes (`popstate`) rather than relying on tab reload triggers.

---

## 13. Response Streaming Behavior

- When ChatGPT is actively generating a response:
  - The assistant turn element receives a `.result-streaming` class.
  - The send button is replaced by a stop generation button.
- **Export Rule**: The adapter must verify `isStreaming() === false` before triggering conversation extraction to avoid capturing partial or incomplete turns.

---

## 14. Virtualization & Lazy-Loading (Long Conversations)

- In long conversations (50+ turns), ChatGPT utilizes virtualized list rendering in its scroll container (`div.overflow-y-auto`).
- Off-screen turns above or below the current viewport may be unmounted from the DOM.
- **Phase 4 Requirement**: An auto-scroller will scroll the conversation container from top to bottom before extraction to force all turns into the DOM.

---

## 15. Candidate Selector Registry

```typescript
export const chatGPTSelectors = {
  conversationContainer: [
    { selector: '[data-testid="conversation-turns-container"]', confidence: 'HIGH' },
    { selector: 'main .flex-1.overflow-hidden', confidence: 'MEDIUM' },
    { selector: 'main', confidence: 'LOW' }
  ],
  turn: [
    { selector: '[data-testid^="conversation-turn-"]', confidence: 'HIGH' },
    { selector: 'article[data-testid^="conversation-turn-"]', confidence: 'HIGH' },
    { selector: 'div[data-message-author-role]', confidence: 'MEDIUM' }
  ],
  userContent: [
    { selector: '.user-message-content', confidence: 'HIGH' },
    { selector: '.whitespace-pre-wrap', confidence: 'MEDIUM' }
  ],
  assistantContent: [
    { selector: '.markdown.prose', confidence: 'HIGH' },
    { selector: '.agent-turn .prose', confidence: 'MEDIUM' }
  ],
  streaming: [
    { selector: '.result-streaming', confidence: 'HIGH' }
  ]
};
```

---

## 16. Maintenance Strategy ("When ChatGPT's DOM Changes")

When OpenAI updates the front-end layout of `chatgpt.com`, follow this diagnostic protocol:

1. **Run Health Diagnostics**: Execute `checkHealth()`. Identify which boolean flag failed (`conversationDetected`, `turnCandidatesFound`, `userTurnsFound`, or `assistantTurnsFound`).
2. **Inspect Live DOM**: Run `inspectDOM()` via DevTools console to inspect current container and turn candidates.
3. **Update Selector Registry**: Add new primary or fallback selectors to `src/adapters/chatgpt/selectors.ts`.
4. **Update DOM Fixtures**: Add a new static HTML snapshot under `tests/fixtures/html/chatgpt-v3-{year}.html`.
5. **Update Adapter Unit Tests**: Add test assertions in `tests/unit/ChatGPTAdapter.test.ts` to verify the new fixture.
6. **Deploy Production Logic**: Update extractor logic only after all fixture unit tests pass.
