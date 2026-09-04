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

## 🛠 Project Status
- **Phase 0 (Complete)**: Architecture design, data models, PDF strategy evaluation, testing framework setup, and project discovery.
- **Phase 1 (Pending)**: Core Extractor, ChatGPT Adapter (Primary selectors), Document Renderer & Local Browser Print Exporter implementation.
