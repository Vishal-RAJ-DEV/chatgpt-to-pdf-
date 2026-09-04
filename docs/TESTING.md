# ChatGPT PDF Exporter - Testing Strategy Specification

## Overview

This document outlines the testing strategy, test categories, test suite structure, and DOM fixture proposals for **ChatGPT PDF Exporter**. It ensures high extraction accuracy, DOM resilience across ChatGPT updates, and accurate PDF document rendering.

---

## 1. Testing Pyramid & Categories

```
                    / \
                   /   \
                  / E2E \       - Extension Messaging & Print Flow
                 /-------\
                /  Integ  \     - Adapter + Extractor + Renderer Integration
               /-----------\
              /    Unit     \   - Model, Extractor, Renderer, Settings
             /---------------\
            /  DOM Fixture    \ - ChatGPT DOM Snapshot Parsing Validation
           ---------------------
```

### 1.1 Unit Testing
- **Scope**: Core models, document renderer, settings storage manager, and utility functions.
- **Framework**: Vitest / Jest.
- **Key Target**: Zero dependency on browser DOM APIs or Chrome Extension runtime where possible.

### 1.2 DOM Fixture Testing
- **Scope**: ChatGPT Adapter and Conversation Extractor validation against saved static HTML snapshots of ChatGPT DOMs.
- **Goal**: Detect breakages when ChatGPT changes class names or HTML structure without requiring live end-to-end browser execution.

### 1.3 Integration Testing
- **Scope**: Content script pipeline: Adapter -> Extractor -> Model -> Renderer.
- **Goal**: Verify that raw DOM input produces the expected HTML document structure and respects user export settings.

### 1.4 E2E / Manual Verification
- **Scope**: Chrome Extension loading in Chromium, popup interactions, `chrome.storage` persistence, browser print triggering.

---

## 2. Comprehensive Test Suite Matrix

| Module / Feature | Test Target | Test Description / Verification Criteria |
| :--- | :--- | :--- |
| **ChatGPT Detection** | `ChatGPTAdapter` | Detects `chatgpt.com` domain, checks DOM ready state, identifies conversation container. |
| **Conversation Detection** | `ChatGPTAdapter` | Extracts conversation title from title element or active sidebar item; falls back to default title if missing. |
| **Role Detection** | `ChatGPTAdapter` | Accurately identifies `user`, `assistant`, and `system` message turns using `data-message-author-role` and fallback selectors. |
| **Extraction - Paragraphs & Text** | `Extractor` | Converts paragraph DOM nodes into clean `ParagraphBlock` objects with sanitized inline HTML. |
| **Extraction - Code Blocks** | `Extractor` | Extracts language tag, raw code content, preserves spacing/indentation, avoids copying line numbers or copy-button UI text. |
| **Extraction - Tables** | `Extractor` | Extracts table headers and cell matrix into `TableBlock`; handles empty cells gracefully. |
| **Extraction - Lists** | `Extractor` | Preserves nested ordered (`<ol>`) and unordered (`<ul>`) list structures into `ListBlock`. |
| **Extraction - Headings** | `Extractor` | Identifies `<h1>`-`<h6>` nodes within message bodies and maps levels accurately. |
| **Extraction - Links** | `Extractor` | Preserves valid `href` attributes while stripping dangerous script protocols (`javascript:`). |
| **Filtering - User Messages** | `Renderer` | When `includeUserMessages = false`, user message turns are completely excluded from rendered document. |
| **Filtering - Assistant Messages** | `Renderer` | When `includeAssistantMessages = false`, assistant turns are excluded from rendered document. |
| **Settings Management** | `SettingsManager` | Persists user preferences to `chrome.storage.local`, validates schema, applies default fallbacks for missing keys. |
| **Rendering Output** | `DocumentRenderer` | Generates valid HTML5 markup with embedded CSS print directives (`@page`, margins, fonts). |
| **Sanitization & Safety** | `Extractor` | Strips `<script>`, `<iframe>`, `on*` event handlers, and active content from raw DOM before rendering. |
| **Filename Formatting** | `PDFExporter` | Sanitizes conversation title into legal OS filenames (strips `\ / : * ? " < > |`). |
| **Long Conversations** | `Adapter` | Handles conversations with 50+ message turns without memory leak or UI thread freezing. |

---

## 3. Proposed DOM Fixture Pipeline

To protect against unexpected breaking changes from OpenAI's front-end updates, static DOM fixtures must be stored under `tests/fixtures/html/`.

### 3.1 Directory Structure
```
tests/
├── fixtures/
│   ├── html/
│   │   ├── chatgpt-v1-2024.html       # Legacy ChatGPT DOM layout
│   │   ├── chatgpt-v2-2025.html       # Modern ChatGPT DOM layout
│   │   ├── chatgpt-code-blocks.html   # Turn containing multiple language code blocks
│   │   ├── chatgpt-tables.html        # Turn containing complex markdown tables
│   │   └── chatgpt-math.html          # Turn containing KaTeX / LaTeX formulas
│   └── expected/
│       ├── model-v1.json              # Expected Normalized Conversation Model JSON
│       └── document-v1.html           # Expected rendered HTML document output
├── unit/
│   ├── Extractor.test.ts
│   ├── DocumentRenderer.test.ts
│   └── SettingsManager.test.ts
└── integration/
    └── AdapterExtractor.test.ts
```

### 3.2 Fixture Example: `tests/fixtures/html/chatgpt-sample.html`
```html
<main>
  <div data-testid="conversation-turn-3" data-message-author-role="user">
    <div class="user-message-content">
      <p>How do I write a Hello World in Python?</p>
    </div>
  </div>
  <div data-testid="conversation-turn-4" data-message-author-role="assistant">
    <div class="markdown prose">
      <p>Here is how you write a Hello World program in Python:</p>
      <pre><code class="language-python">print("Hello, World!")</code></pre>
    </div>
  </div>
</main>
```

---

## 4. Test Execution & Automation Plan

### 4.1 Test Commands
- `npm test`: Runs Vitest unit test suite across core models, extractor, and renderer.
- `npm run test:fixtures`: Runs DOM fixture regression tests against stored HTML snapshots.
- `npm run typecheck`: Validates strict TypeScript compilation across the workspace.

### 4.2 CI/CD Automation Requirements
- Run `typecheck` and `test` on every pull request.
- Warn if extraction confidence falls below 100% on any DOM fixture.
