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
- [Release Checklist](docs/RELEASE_CHECKLIST.md)

## 🛠 Project Status
- **Phases 0–9 (Complete)**: Core model, ChatGPT DOM adapter, rich content extraction, virtualized scrolling, Phase 8 visual matching, Phase 9 resilience & diagnostics.
- **Phase 10 (Complete)**: Browser Integration & End-to-End Validation — full messaging round-trip, settings-to-renderer pipeline, print surface cleanup, SPA route navigation protection, and local privacy guarantees.
- **Phase 11 (Complete)**: Production Hardening & Release Readiness — manifest V3 audit, permissions minimization, duplicate export click protection, accessibility focus rules, error boundary hardening, reproducible release packaging script, and release checklist.

## 📦 How to Build & Load in Chrome

Follow these steps to build and load the extension into Chrome:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build Extension**:
   ```bash
   npm run build
   ```
   *(Compiles TypeScript and outputs extension bundle to `dist/` directory.)*

3. **Package Release Bundle**:
   ```bash
   npm run package
   ```
   *(Creates release ZIP archive `dist/chatgpt-pdf-exporter-v0.1.0.zip` containing production assets.)*

4. **Load Unpacked Extension into Chrome**:
   - Open Chrome and navigate to `chrome://extensions`.
   - Enable **Developer mode** (top-right corner).
   - Click **Load unpacked** and select the `dist/` folder.

## 🧪 Verification Commands

- **Typecheck**: `npm run typecheck`
- **Unit & Integration Tests**: `npm test`
- **Build**: `npm run build`
- **Package Release ZIP**: `npm run package`

