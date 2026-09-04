# End-to-End Browser Testing Guide — ChatGPT PDF Exporter

This document details manual and browser-level validation steps for testing the unpacked Chrome extension end-to-end.

---

## 1. Prerequisites

- **Google Chrome** (v110+ recommended for Manifest V3 support).
- **Node.js** (v18+) and **npm**.

---

## 2. Build the Extension

From the root directory:

```bash
npm run typecheck
npm test
npm run build
```

This compiles TypeScript and outputs production-ready extension artifacts to the `dist/` directory:
- `dist/manifest.json`
- `dist/content.js` (Vite content script bundle)
- `dist/popup.js` & `dist/src/ui/popup/popup.html`
- `dist/options.js` & `dist/src/ui/options/options.html`

---

## 3. Load Unpacked Extension into Chrome

1. Open Chrome and navigate to `chrome://extensions`.
2. Toggle **Developer mode** (top-right corner).
3. Click **Load unpacked** (top-left corner).
4. Select the `dist/` directory inside `d:\WEB DEVELOPMENT\Extention\chatgpt-pdf-exporter`.
5. Confirm "ChatGPT PDF Exporter" (v0.1.0) appears active without errors.

---

## 4. Exporting a ChatGPT Conversation

1. Open [https://chatgpt.com](https://chatgpt.com) and navigate into a specific conversation (URL path: `/c/<uuid>`).
2. Click the extension toolbar icon to open the **Popup UI**.
3. Verify the status badge displays **"Ready — ChatGPT conversation"**.
4. Click **Export PDF**:
   - Status transitions: `"Extracting conversation…"` → `"Preparing printable document…"` → `"Opening print dialog…"`.
5. Native browser print surface opens:
   - Destination: Select **Save as PDF**.
   - Review page formatting, typography, code blocks, and page numbers.
   - Click **Save** to export the PDF.

---

## 5. Testing Settings & Customization

1. Click **Open Settings** from the popup or right-click extension icon → **Options**.
2. Customize export preferences:
   - **Page Size**: A4 vs Letter
   - **Orientation**: Portrait vs Landscape
   - **Margins**: Normal, Compact, Narrow, Wide
   - **Toggles**: User Messages, Assistant Messages, Title, Date, Source URL, Page Numbers
   - **Code Theme**: GitHub Light, Monokai, Solarized Light
3. Click **Save Settings**.
4. Export a conversation and verify the generated PDF reflects saved options.

---

## 6. Testing SPA Navigation & Long Conversations

### SPA Navigation
1. Open Conversation A (`/c/aaa`) → click **Export PDF**.
2. Click another conversation in ChatGPT sidebar (Conversation B at `/c/bbb`) without reloading the page.
3. Open extension popup and click **Export PDF**.
4. Confirm Conversation B content is exported without stale data from Conversation A.

### Long Virtualized Conversations
1. Open a long conversation with 30+ messages.
2. Click **Export PDF**.
3. Observe incremental scrolling as `LongConversationExtractor` collects historical mounted turns.
4. Confirm all turns are included chronologically without duplicate messages.

---

## 7. Known Limitations

- **Browser Window Focus**: `window.print()` requires transient window focus. Pop-up blockers must allow extension pop-ups.
- **Client-Side Print Dialog Interactivity**: Chrome does not fire a JavaScript callback when a user cancels the native print dialog; the extension correctly reports when the print dialog opens.
- **Local Privacy Guarantee**: No conversation content or telemetry ever leaves your browser.
