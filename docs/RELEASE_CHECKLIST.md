# Extension Release Checklist — ChatGPT PDF Exporter

This checklist outlines the mandatory steps required before publishing or releasing a new version of the ChatGPT PDF Exporter Chrome Extension.

---

## 1. Manifest & Permissions Audit
- [ ] **Manifest V3 Compliance**: Confirm `manifest_version: 3` and `"minimum_chrome_version": "110"` are set in `manifest.json`.
- [ ] **Permissions Allow-list**: Confirm declared `permissions` are restricted to the verified allow-list `["storage", "activeTab"]`.
- [ ] **Host Scope**: Confirm `content_scripts.matches` contains ONLY `["https://chatgpt.com/*"]`.
- [ ] **No High-Risk Permissions**: Verify broad host permissions (`<all_urls>`, `*://*/*`), `tabs`, `scripting`, `webRequest`, `cookies`, or `debugger` are **NOT** present.


---

## 2. Automated Quality Verification
- [ ] **TypeScript Typecheck**:
  ```bash
  npm run typecheck
  ```
  *(Must exit with code 0).*

- [ ] **Automated Test Suite**:
  ```bash
  npm test
  ```
  *(All 28+ test files / 240+ unit & integration tests must pass).*

- [ ] **Production Build**:
  ```bash
  npm run build
  ```
  *(Must build clean bundles in `dist/` without errors or missing modules).*

---

## 3. Release Package Generation
- [ ] **Generate Release ZIP**:
  ```bash
  npm run package
  ```
- [ ] **Verify ZIP Artifact**:
  - Location: `dist/chatgpt-pdf-exporter-v0.1.0.zip`.
  - Contents: Manifest, `content.js`, `popup.js`, `options.js`, popup HTML/CSS, options HTML/CSS.
  - Exclusions: Confirm `node_modules`, `.git`, `.ts` source files, tests, and scratch files are **NOT** included in the ZIP.

---

## 4. Manual Acceptance Validation (Real Chrome)
- [ ] **Unpacked Extension Loading**:
  1. Open Chrome → `chrome://extensions`.
  2. Enable Developer mode → click **Load unpacked**.
  3. Select the `dist/` folder.
  4. Verify zero manifest loading errors or warnings.
- [ ] **ChatGPT Export Smoke Test**:
  1. Open [https://chatgpt.com](https://chatgpt.com) conversation (`/c/<uuid>`).
  2. Click Extension Icon → Status badge: `"Ready — ChatGPT conversation"`.
  3. Click **Export PDF** → Print dialog opens formatted conversation.
  4. Save PDF and verify formatting, code blocks, lists, typography, and page numbers.
- [ ] **Options / Settings Verification**:
  1. Open Settings page → Change Page Size / Theme / Margins → Click **Save Settings**.
  2. Re-export conversation → Verify updated settings are applied to PDF.
- [ ] **SPA Navigation Smoke Test**:
  1. Click another conversation in sidebar without reloading page.
  2. Click **Export PDF** → Verify newly selected conversation is exported without stale data from previous chat.
- [ ] **Privacy & Security Guarantee**:
  1. Open DevTools Network Tab during export.
  2. Confirm 0 external HTTP/XHR/fetch requests are sent during extraction or rendering.

---

## 5. Version Consistency
- [ ] `manifest.json` version matches `package.json` version ("0.1.0").
- [ ] Release package file follows canonical naming: `chatgpt-pdf-exporter-v<version>.zip`.
- [ ] `README.md` documentation reflects current version and features.
