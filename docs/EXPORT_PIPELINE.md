# Local PDF Export Pipeline Specification (Phase 6)

## Overview

The Export Pipeline provides an end-to-end, local export workflow from the active ChatGPT conversation DOM to the native browser print engine.

```
Popup UI (active tab check, Export button)
   ↓ chrome.tabs.sendMessage("EXTRACT_CONVERSATION")
Content Script (injected on chatgpt.com)
   ↓ ChatGPTAdapter & RichContentExtractor
Normalized Conversation Model
   ↓
ExportService (Orchestrator)
   ↓ SettingsManager -> toRenderOptions()
RenderOptions
   ↓ DocumentRenderer
Standalone Printable HTML
   ↓ PrintService
Local Browser Print Dialog (window.print())
   ↓
User saves as PDF
```

---

## 1. Core Components & Responsibilities

### 1.1 Extension Popup UI (`src/ui/popup/`)
- Checks if active browser tab is a supported ChatGPT conversation page (`https://chatgpt.com/*`).
- Displays page readiness badge (`Ready on ChatGPT` or `Unsupported page`).
- Provides primary action button: **Export as PDF**.
- Disables button during export to prevent concurrent double clicks.
- Displays progress states (`extracting`, `rendering`, `printing`) and user-friendly error messages.

### 1.2 Content Script Messaging (`src/content/contentScript.ts`)
- Listens for runtime message `EXTRACT_CONVERSATION`.
- Checks DOM readiness and assistant response streaming (`isStreaming()`).
- Rejects extraction if streaming is active (`STREAMING_IN_PROGRESS`).
- Invokes `extractConversation()` to generate normalized `Conversation` model.
- Returns JSON payload back to extension context.

### 1.3 Export Service Orchestrator (`src/core/export/ExportService.ts`)
- Manages the single orchestration path across content script, settings, renderer, and print surface.
- Implements concurrency locking (`isExporting`) to guarantee safe execution.
- Loads user settings via `SettingsManager.loadSettings()` and converts to `RenderOptions`.
- Invokes `DocumentRenderer.renderConversation()` to create standalone printable HTML.

### 1.4 Print Surface Layer (`src/core/export/PrintService.ts`)
- Opens an isolated, temporary print surface window.
- Writes the standalone HTML document string.
- Waits for layout/style attachment with a bounded timeout (`timeoutMs: 5000`).
- Triggers `window.print()` for native browser PDF saving.

---

## 2. Error Model & Codes

Structured errors are managed by `ExportError` in `src/core/export/ExportErrors.ts`:

| Error Code | Trigger Condition | User Message |
| :--- | :--- | :--- |
| `UNSUPPORTED_PAGE` | Active tab is not on `chatgpt.com` | "Open a ChatGPT conversation first." |
| `CONVERSATION_NOT_READY` | Page DOM is not fully ready | "ChatGPT page is not fully loaded. Please wait a moment." |
| `STREAMING_IN_PROGRESS` | Assistant is actively generating response | "ChatGPT is still generating a response. Wait until it finishes." |
| `CONVERSATION_NOT_FOUND` | No turn candidates in DOM | "Could not find a valid ChatGPT conversation on this page." |
| `EXTRACTION_FAILED` | DOM extraction error | "Failed to extract conversation content. Please try refreshing." |
| `RENDER_FAILED` | Document renderer failed | "Failed to render document. Please check settings." |
| `PRINT_FAILED` | Window opening or print dialog failed | "Could not open browser print dialog. Please try again." |
| `PRINT_TIMEOUT` | Print surface load timed out | "Print preparation timed out. Please try again." |

---

## 3. Native Browser Print Rationale

### Why Native `window.print()`?
1. **True Vector PDFs**: Produces crisp, searchable vector text with selectable copyable text and clickable URLs.
2. **Zero Heavy Dependencies**: Eliminates complex client-side PDF binary libraries (`jsPDF`, `html2pdf.js`, `pdf-lib`) and canvas rasterization bugs.
3. **Native CSS Pagination**: Leverages Chrome's native print engine supporting `@page` size/margin rules and `break-inside: avoid`.
4. **100% Local Privacy**: Requires zero server calls or external PDF rendering APIs.

---

## 4. Security & Privacy Guarantees

- **No Remote APIs**: No data is sent to external services or cloud engines.
- **No Conversation Storage**: Conversation content exists strictly in runtime memory during export and is **never** persisted to `chrome.storage` or disk.
- **No Page Mutation**: The active ChatGPT page DOM is read passively and never altered or re-navigated.
- **Safe HTML Escaping**: HTML rendering is strictly sanitized by `DocumentRenderer.ts`.
