# ChatGPT PDF Exporter - Architecture Specification

## Executive Summary

**ChatGPT PDF Exporter** is a privacy-first, local-processing Chrome Extension (Manifest V3) that extracts ChatGPT conversations directly from the DOM, transforms them into a normalized model, renders clean document HTML, and exports high-quality PDFs without sending data to external APIs.

---

## 1. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------+
|                             ChatGPT DOM                               |
+-----------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                            Content Script                             |
|  - Injected on chatgpt.com                                            |
|  - Triggers extraction on user request or UI message                   |
+-----------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                           ChatGPT Adapter                             |
|  - Encapsulates DOM selectors & fallback strategies                   |
|  - Locates conversation container, message turns, & roles             |
|  - Health checks & DOM structure validation                           |
+-----------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                        Conversation Extractor                         |
|  - Parses message node DOM elements                                   |
|  - Converts raw DOM nodes into abstract ContentBlock primitives       |
+-----------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                     Normalized Conversation Model                     |
|  - Pure data representation (Conversation, Message, ContentBlock)     |
|  - Completely decoupled from ChatGPT DOM and extension UI             |
+-----------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                           Document Renderer                           |
|  - Merges Conversation Model + User ExportSettings                    |
|  - Generates standalone, styled HTML document with CSS print rules     |
+-----------------------------------------------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                           PDF Export Layer                            |
|  - Manages printing/saving (Browser Print window / Offscreen render)  |
|  - Zero external cloud API calls; 100% local processing               |
+-----------------------------------------------------------------------+
                                    ^
                                    |
+-----------------------------------------------------------------------+
|                   Popup / Extension Options UI                        |
|  - User configuration (margins, theme, message filters, page size)    |
|  - Persisted via chrome.storage.local                                 |
+-----------------------------------------------------------------------+
```

---

## 2. Core Architectural Components

### 2.1 Content Script
- **Role**: Entry point executing in the context of `https://chatgpt.com/*`.
- **Responsibilities**:
  - Listens for messages from the Popup / Action UI.
  - Instantiates the ChatGPT Adapter and triggers conversation extraction.
  - Passes extracted Normalized Conversation Model to Background worker / Renderer.
  - Mounts in-page quick-action export button (optional feature in later phase).

### 2.2 ChatGPT Adapter
- **Role**: DOM abstraction layer isolating ChatGPT DOM selector logic.
- **Responsibilities**:
  - Detects if ChatGPT DOM is ready and stable.
  - Implements multi-tier selector fallbacks (primary class, data attributes, aria attributes, structural tree search).
  - Identifies message elements, author roles (`user`, `assistant`, `system`), timestamps, and title elements.
  - Emits diagnostics when selectors fail due to ChatGPT site updates.

### 2.3 Conversation Extractor
- **Role**: Structural HTML parser.
- **Responsibilities**:
  - Iterates over raw DOM nodes within message bodies.
  - Maps DOM nodes to standard `ContentBlock` items (paragraphs, code blocks, lists, headings, quotes, tables, math formulas).
  - Sanitizes content to strip injected scripts or dynamic browser elements.

### 2.4 Normalized Conversation Model
- **Role**: Pure JavaScript/TypeScript object structure.
- **Responsibilities**:
  - Standardized JSON representation of the entire conversation.
  - Completely agnostic of browser, DOM, or export format.
  - Enables serializing, saving, or testing without DOM dependencies.

### 2.5 Settings System
- **Role**: Preferences management backed by `chrome.storage.local`.
- **Responsibilities**:
  - Defines default settings (Content, Page, Typography, Code, Theme).
  - Provides type-safe settings migration and retrieval methods.

### 2.6 Document Renderer
- **Role**: HTML template generator.
- **Responsibilities**:
  - Accepts `Conversation` model + `ExportSettings`.
  - Filters messages based on settings (e.g. exclude user prompts or assistant turns).
  - Applies CSS layout rules, page margins, typography choices, syntax highlighting, and theme colors.
  - Emits a clean standalone HTML document with embedded CSS.

### 2.7 PDF Export Layer
- **Role**: Local PDF engine.
- **Responsibilities**:
  - Takes rendered HTML document and triggers local browser print preview / PDF render.
  - Guarantees 100% privacy with zero network calls.

### 2.8 Popup & Options UI
- **Role**: User control panel.
- **Responsibilities**:
  - Action popup for quick "Export to PDF" trigger.
  - Settings UI for customizing document appearance and inclusions.

### 2.9 Future Long-Conversation Loader
- **Role**: Auto-scroll / dynamic pagination handler.
- **Responsibilities**:
  - Automatically scrolls virtualized lists in long ChatGPT conversations to force lazy-loaded message turns into the DOM before extraction begins.

### 2.10 Testing Strategy
- **Role**: Verification matrix.
- **Responsibilities**:
  - Unit tests for Extractor and Renderer using DOM snapshots.
  - Integration tests for Settings and Extension Messaging.

---

## 3. Target Folder Structure

```
chatgpt-pdf-exporter/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DESIGN_REFERENCE.md
│   └── TESTING.md
├── src/
│   ├── adapters/
│   │   └── chatgpt/
│   │       ├── ChatGPTAdapter.ts       # DOM discovery & turn extraction
│   │       ├── selectors.ts            # Centralized selector registry & fallbacks
│   │       └── healthCheck.ts          # DOM validation & health diagnostics
│   ├── core/
│   │   ├── conversation/
│   │   │   ├── Extractor.ts            # DOM node -> ContentBlock parser
│   │   │   └── Model.ts                # TypeScript interface definitions
│   │   ├── renderer/
│   │   │   ├── DocumentRenderer.ts     # Model + Settings -> HTML document
│   │   │   ├── styles/                 # Modular CSS templates
│   │   │   │   ├── base.css
│   │   │   │   ├── typography.css
│   │   │   │   └── print.css
│   │   │   └── components/             # Renderers for code, table, list, etc.
│   │   └── exporter/
│   │       ├── PDFExporter.ts          # Local print/PDF trigger
│   │       └── PrintWindow.ts          # Offscreen print handler
│   ├── settings/
│   │   ├── SettingsManager.ts          # chrome.storage adapter
│   │   ├── defaults.ts                 # Default configuration values
│   │   └── types.ts                    # ExportSettings interface definitions
│   ├── content/
│   │   └── contentScript.ts            # Extension content script entry point
│   ├── background/
│   │   └── serviceWorker.ts            # MV3 background worker
│   ├── ui/
│   │   ├── popup/                      # Extension popup UI
│   │   │   ├── popup.html
│   │   │   └── popup.ts
│   │   └── options/                    # Options page UI
│   │       ├── options.html
│   │       └── options.ts
│   └── utils/
│       ├── domUtils.ts                 # DOM helper utilities
│       └── logger.ts                   # Diagnostic logging
├── manifest.json                       # Chrome MV3 manifest
├── package.json                        # Dependencies & scripts
├── tsconfig.json                       # TypeScript compiler settings
└── vite.config.ts                      # Vite build configuration
```

### Architectural Reasoning
1. **Separation by Layer**: `adapters/`, `core/`, `settings/`, `content/`, and `ui/` are cleanly separated. `core/` has **zero** dependencies on ChatGPT DOM or Chrome APIs.
2. **Centralized Selectors**: All DOM selectors reside strictly under `src/adapters/chatgpt/selectors.ts`.
3. **Pure Core Logic**: `core/conversation` and `core/renderer` can be executed in isolated node environments or unit tests without needing a browser extension environment.

---

## 4. Architectural Boundaries & Strict Rules

| Module | Permitted Responsibilities | STRICT Prohibitions |
| :--- | :--- | :--- |
| **ChatGPT Adapter** | Detect ChatGPT DOM, locate turns, extract raw elements. | MUST NOT format final HTML, alter user settings, or handle PDF creation. |
| **Conversation Model** | Represent pure structured conversation data. | MUST NOT contain DOM references (`HTMLElement`) or UI rendering logic. |
| **Renderer** | Transform Model + Settings into styled HTML string. | MUST NOT touch ChatGPT DOM directly or perform browser network requests. |
| **Settings System** | Store & retrieve user preferences via `chrome.storage`. | MUST NOT extract DOM elements or handle document rendering. |
| **Exporter** | Convert rendered HTML into local PDF via browser print API. | MUST NOT depend on external server APIs (e.g. PDFCrowd). |
| **UI** | Display settings controls, trigger export actions, show progress. | MUST NOT contain hardcoded ChatGPT DOM selectors. |

---

## 5. Initial Data Models

```typescript
/**
 * Represents a complete conversation session.
 */
export interface Conversation {
  id: string;
  title: string;
  url: string;
  createdAt: string; // ISO 8601 string
  messages: Message[];
}

/**
 * Author roles in a conversation turn.
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Individual message turn.
 */
export interface Message {
  id: string;
  role: MessageRole;
  timestamp?: string;
  blocks: ContentBlock[];
}

/**
 * Primitive content block types within a message body.
 */
export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | CodeBlock
  | QuoteBlock
  | TableBlock
  | ImageBlock
  | MathBlock;

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

/**
 * User configurable export settings.
 */
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
      top: number;    // mm
      right: number;  // mm
      bottom: number; // mm
      left: number;   // mm
    };
    showPageNumbers: boolean;
  };
  typography: {
    fontFamily: string;
    fontSize: number;   // pt
    lineHeight: number;
  };
  code: {
    fontFamily: string;
    fontSize: number;   // pt
    wrapLines: boolean;
  };
  appearance: {
    theme: 'light' | 'dark';
  };
}
```

---

## 6. PDF Generation Strategy Evaluation

| Criteria | Option A: HTML + Browser Print (`window.print()`) | Option B: Client PDF Lib (e.g. `html2pdf.js`, `jsPDF`) | Option C: Local Rendering Server Process |
| :--- | :--- | :--- | :--- |
| **Privacy & Security** | 100% Local (Native browser engine) | 100% Local (JS Bundle) | Requires external local app running |
| **Implementation Complexity** | Low (Native browser CSS `@page` media) | High (Canvas rasterization issues, font bugs) | Extremely High |
| **PDF Quality** | Vector text, crisp searchability | Raster/Canvas output (often pixelated) | Vector |
| **Page Breaking & Selectable Text** | Native CSS print breaks; 100% selectable | Brittle canvas splitting | Native |
| **Bundle Size Impact** | 0 KB extra dependencies | +500KB - 2MB JS libraries | Requires installer |
| **Browser Compatibility** | Excellent in Chromium | Moderate | Requires native host |

### Recommendation for Phase 1
**Option A (Generated HTML + Browser Local Print)** is strongly recommended.
- It produces true vector PDFs with selectable text, clickable links, and native pagination.
- It introduces zero heavy third-party bundle overhead.
- It adheres strictly to local processing and user privacy requirements.

---

## 7. ChatGPT DOM Risk Strategy

### Risk Factors
1. Class names in ChatGPT (e.g., `tailwind` classes) update frequently during OpenAI deployments.
2. SPA navigation (`history.pushState`) re-uses DOM containers without full page reloads.
3. Virtualized rendering unmounts off-screen message turns in very long chats.

### Mitigation Architecture
1. **Selector Fallback Pipeline**:
   ```typescript
   // Attempt primary selector -> fallback data-attribute -> structural tree fallback
   const messageNodes = 
     querySelectorAll(PRIMARY_SELECTOR) ||
     querySelectorAll(DATA_ATTR_FALLBACK) ||
     findMessagesByStructure(rootNode);
   ```
2. **DOM Health Diagnostic Check**:
   - Before attempting extraction, validate that essential structural nodes exist.
   - If extraction confidence is low, present a fallback notification to the user rather than producing corrupted PDFs.
3. **Adapter Isolation**:
   - Updates to ChatGPT's UI only require changes inside `src/adapters/chatgpt/`. The rest of the codebase remains unaffected.

---

## 8. Development Roadmap & Incremental Phases

- **Phase 0 (Complete)**: Project discovery, architecture definition, documentation & repository scaffolding.
- **Phase 1 (Complete)**: Extension Foundation, Chrome MV3 manifest, Vite build setup, popup UI, content script diagnostics.
- **Phase 2 (Complete)**: Current ChatGPT DOM discovery, selector registry, adapter health checks, and DOM fixtures.
- **Phase 3A (Complete)**: Normalized Conversation Domain Model specification and pure TypeScript contracts.
- **Phase 3B (Complete)**: Plain ChatGPT conversation extraction engine and streaming protection.
- **Phase 3C (Complete)**: Rich Content Extraction Engine (paragraphs, headings, lists, code, tables, quotes, images, math).
- **Phase 4 (Complete)**: Document Renderer (pure HTML document generator, CSS print rules, security escaping, role filtering).
- **Phase 5 (Pending)**: Settings System & User Configuration Persistence (`chrome.storage`).
- **Phase 6 (Pending)**: Local Browser PDF Generation & Extension Export UI.

