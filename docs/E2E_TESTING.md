# End-to-End Browser Testing & Validation Guide — ChatGPT PDF Exporter

This document details automated integration testing, SPA lifecycle simulation, and manual Chromium acceptance procedures for validating the unpacked Chrome extension end-to-end (Phase 10).

---

## 1. Test Architecture & Validation Framework

The testing suite for Phase 10 consists of two complementary layers:
1. **Automated Vitest Integration & JSDOM Simulations** — Fast, reproducible test suites validating DOM extraction, message passing, settings application, print rendering, and SPA history navigation.
2. **Manual Chromium Acceptance Validation** — Real Chrome browser verification of popup rendering, extension background messaging, native `window.print()` invocation, and PDF file generation.

---

## Section A: Automated Vitest Integration Tests (JSDOM Simulation)

Automated tests are executed using Vitest with JSDOM environment. These tests simulate browser extension APIs (`chrome.tabs`, `chrome.runtime`), DOM documents, and window events without launching full Chromium browser instances.

### Executive Test Matrix

| Test Suite File | Test Scope | Verification Focus |
| :--- | :--- | :--- |
| `tests/integration/BrowserPdfSmoke.test.ts` | Renderer HTML Smoke Test (Vitest Simulation) | Validates end-to-end rendering from normalized `Conversation` object into styled HTML document string ready for printing. |
| `tests/integration/PrintServiceIntegration.test.ts` | PrintService Contract & Mocked Lifecycle Tests (Vitest Simulation) | Verifies iframe creation, print document injection, print command trigger, iframe removal, and temporary DOM cleanup. |
| `tests/integration/MessageRoundTrip.test.ts` | Extension Message Boundary Simulation Tests (Vitest Simulation) | Validates round-trip IPC messaging between Popup, Content Script, Extractor, Renderer, and PrintService. |
| `tests/integration/PrivacySecurityAudit.test.ts` | Privacy, Network & Security Integration Audit Tests (Vitest Simulation) | Audits zero external HTTP/XHR/Fetch requests, strict CSP policy, and 100% local PDF generation. |
| `tests/integration/SPANavigation.test.ts` | SPA Extraction & Route Transition Regression Tests (Vitest Simulation) | Ensures client-side route navigation (`pushState`, `replaceState`, `popstate`) extracts fresh DOM data without returning stale cached conversations. |

To run the automated suite:
```bash
npm run typecheck
npm test
```

---

## Section B: SPA Lifecycle Harness Simulation

The SPA Lifecycle Harness in `tests/integration/SPANavigation.test.ts` specifically tests client-side Single Page Application (SPA) state changes typical of modern ChatGPT interface implementations (React / Next.js).

### Verified Lifecycle Scenarios
- **Scenario 1 (A → B Transition)**: Navigation from conversation A (`/c/uuid-1`) to conversation B (`/c/uuid-2`) updates the extraction target dynamically without returning cached data from A.
- **Scenario 2 (A → Home → B Transition)**: Navigating to the ChatGPT home route (`/`) returns an explicit `failure` status (no conversation present), followed by clean extraction when navigating into conversation B.
- **Scenario 3 (A → B → A Return Navigation)**: Re-visiting conversation A after visiting conversation B extracts fresh state for A upon return.
- **Scenario 4 (Messaging Context Update)**: `ExportService` requests fresh active tab URL and DOM content on every export action.
- **Scenario 5 (History API & DOM Replacement Harness)**: Simulates native `window.history.pushState()`, `window.history.replaceState()`, `popstate` events, and DOM tree node replacements to ensure zero stale conversation data leakage across SPA state updates.

---

## Section C: Step-by-Step Manual Chromium Acceptance Procedure

To validate the unpacked extension in a real Chrome browser instance:

### Step 1: Build Extension
```bash
npm run typecheck
npm test
npm run build
```
Verify the output artifacts in `dist/`:
- `dist/manifest.json`
- `dist/content.js`
- `dist/popup.js` & `dist/src/ui/popup/popup.html`
- `dist/options.js` & `dist/src/ui/options/options.html`

### Step 2: Load Unpacked Extension into Chrome
1. Open Google Chrome (v110+).
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in top-right corner).
4. Click **Load unpacked** (top-left button).
5. Select the `dist/` directory inside `d:\WEB DEVELOPMENT\Extention\chatgpt-pdf-exporter`.
6. Verify "ChatGPT PDF Exporter" (v0.1.0) is listed active with zero errors.

### Step 3: Export Real Conversation
1. Open [https://chatgpt.com](https://chatgpt.com) and log in.
2. Select any active conversation (URL path: `/c/<uuid>`).
3. Click the extension toolbar icon to open the **Popup UI**.
4. Confirm status displays `"Ready — ChatGPT conversation"`.
5. Click **Export PDF**.
6. Observe status progress: `"Extracting conversation…"` → `"Preparing printable document…"` → `"Opening print dialog…"`.
7. Verify native print preview window opens containing the formatted conversation.
8. Select **Save as PDF** as the destination and click **Save**.

### Step 4: Verify Custom Settings & SPA Navigation
1. Open Options page (`chrome-extension://<id>/src/ui/options/options.html`).
2. Change page size (e.g., Letter), theme (e.g., Monokai), or toggle options. Click **Save Settings**.
3. Re-export conversation and verify changes appear in PDF.
4. Click another conversation in the ChatGPT sidebar without refreshing the page. Click **Export PDF** and verify the PDF matches the newly selected conversation without stale content.

---

## Section D: Environment Limitations & Scope Transparency

### Automation Environment Scope
- **Headless Container Constraints**: This environment runs in a non-interactive Windows environment where Chrome GUI display servers and automated browser drivers (Playwright / Puppeteer binaries) are not pre-installed.
- **JSDOM Simulation Coverage**: Automated integration testing relies on Vitest with JSDOM. While JSDOM provides high-fidelity DOM and window object emulation, native Chromium capabilities (such as GPU rendering, OS native file dialogs, and native browser print preview dialog rendering) are covered through manual acceptance testing procedures.
- **Local Privacy Enforcement**: Production builds contain zero network fetch or telemetry logic, guaranteeing complete local-only execution.

