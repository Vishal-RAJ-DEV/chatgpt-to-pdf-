# ChatGPT PDF Exporter

A privacy-focused Chrome Extension (Manifest V3) that exports ChatGPT conversations into clean, high-quality, custom-styled PDFs using local browser processing.

## 🚀 Key Features (Target Architecture)
- **100% Local Processing**: No external cloud service or third-party PDF server calls.
- **Full Customization**: Configure margins, typography, page formats (A4/Letter), and themes (Light/Dark).
- **Rich Content Parsing**: Formats code blocks, tables, lists, headings, and quotes cleanly.
- **Robust Adapter Architecture**: Isolate ChatGPT DOM changes to a dedicated adapter layer with selector fallbacks.

## 📁 Documentation
- [Architecture Specification](docs/ARCHITECTURE.md)
- [Visual Design Reference](docs/DESIGN_REFERENCE.md)
- [Testing Strategy](docs/TESTING.md)
- [End-to-End Testing Guide](docs/E2E_TESTING.md)

## 🛠 Project Status
- **Phases 0–9 (Complete)**: Core model, ChatGPT DOM adapter, rich content extraction, virtualized scrolling, Phase 8A tokens, Phase 8B layout, Phase 8C pagination, Phase 8D PDFCrowd controls, Phase 8E visual matching, Phase 9 resilience & diagnostics.
- **Phase 10 (Complete)**: Browser Integration & End-to-End Validation — full messaging round-trip, settings-to-renderer pipeline, print surface cleanup, SPA route navigation protection, and local privacy guarantees.

## 📦 How to Load in Chrome (Phase 1)

Follow these steps to build and load the extension into Chrome:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build the Extension**:
   ```bash
   npm run build
   ```
   *(This compiles TypeScript, bundles the popup, options page, and content script, and outputs to the `dist/` directory.)*

3. **Open Chrome Extensions Page**:
   Open Chrome and navigate to `chrome://extensions`.

4. **Enable Developer Mode**:
   Toggle the **Developer mode** switch in the top-right corner of the page.

5. **Load Unpacked Extension**:
   Click the **Load unpacked** button in the top-left corner and select the `dist/` folder inside this project directory.

6. **Verify Installation**:
   - Click the extension icon in Chrome to view the popup status ("Extension installed ✓").
   - Click **Open Settings** to open the options page.
   - Open [https://chatgpt.com](https://chatgpt.com), open the Developer Tools Console (`F12`), and confirm the diagnostic log:
     ```text
     [ChatGPT PDF Exporter] Content script loaded
     [ChatGPT PDF Exporter] Host supported: true
     [ChatGPT PDF Exporter] Document ready: true
     ```

## 🧪 Running Tests & Typechecking

- **Typecheck**: `npm run typecheck`
- **Unit Tests**: `npm test`
- **Build**: `npm run build`
