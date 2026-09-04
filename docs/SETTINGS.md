# Dynamic Settings System Specification (Phase 5)

## Overview

The Dynamic Settings System manages user configurable document rendering options for the ChatGPT PDF Exporter extension.

```
Options UI / Popup UI
         ↓
  SettingsManager (chrome.storage.local)
         ↓
    UserSettings (Validation & Defaults)
         ↓
 toRenderOptions() (Conversion Boundary)
         ↓
   RenderOptions
         ↓
  DocumentRenderer (Pure HTML Generator)
```

The settings layer is completely decoupled from the core document renderer and ChatGPT content extraction modules. The renderer consumes only pure `RenderOptions` objects without dependency on `chrome.storage`.

---

## User Settings Model

The core user settings interface is defined in `src/core/settings/Settings.ts`:

```typescript
export interface UserSettings {
  // Page geometry
  pageSize: 'A4' | 'LETTER';
  orientation: 'portrait' | 'landscape';
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;

  // Typography
  fontFamily: string;
  baseFontSize: string;
  lineHeight: number;

  // Content visibility
  showUserMessages: boolean;
  showAssistantMessages: boolean;
  showConversationTitle: boolean;
  showDate: boolean;
  showFooterPageNumbers: boolean;

  // Code formatting
  codeTheme: 'light' | 'dark';

  // Layout
  headingSpacing: boolean;
}
```

---

## Canonical Defaults

Canonical default values are defined in a single source of truth in `src/core/settings/defaults.ts`:

- **Page Size**: `A4`
- **Orientation**: `portrait`
- **Margins**: `18mm` top/right/bottom/left
- **Font Family**: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...`)
- **Base Font Size**: `10pt`
- **Line Height**: `1.5`
- **Message Toggles**: `showUserMessages: true`, `showAssistantMessages: true`
- **Header/Footer**: `showConversationTitle: true`, `showDate: true`, `showFooterPageNumbers: true`
- **Code Theme**: `dark`
- **Heading Spacing**: `true`

---

## Validation & Security Engine

Strict input validation is enforced by `src/core/settings/validation.ts`:

1. **Enum Enforcement**: `pageSize`, `orientation`, and `codeTheme` are restricted to valid enum sets. Any unrecognized string falls back to default.
2. **CSS Length Sanitization**: Margins and font sizes are checked against `/^\d+(?:\.\d+)?(?:mm|cm|in|px|pt|rem|em|%)?$/i` and forbidden from containing characters (`{`, `}`, `;`, `:`, `<`, `>`, `\n`, `\r`) to eliminate CSS injection vulnerabilities.
3. **Font Family Sanitization**: Strips unsafe injection control characters and bounds max string length to 250 characters.
4. **Line Height Boundary**: Validated as a finite number between `0.5` and `3.0`.
5. **Boolean Strictness**: Ensures boolean flags are explicitly boolean.

---

## Storage & Schema Versioning

Settings are stored in `chrome.storage.local` under key `chatgpt_pdf_exporter_settings` with versioning metadata:

```json
{
  "chatgpt_pdf_exporter_settings": {
    "version": 1,
    "values": {
      "pageSize": "A4",
      "orientation": "portrait",
      "marginTop": "18mm",
      "...": "..."
    }
  }
}
```

`SettingsManager` handles async CRUD methods:
- `loadSettings()`: Reads storage, migrates schema versions if necessary, validates values, and falls back to defaults for missing fields.
- `saveSettings(settings)`: Validates and persists full settings object.
- `resetSettings()`: Replaces storage with canonical defaults.
- `updateSettings(partial)`: Performs atomic partial update.

---

## Privacy & Data Guarantees

- **No Conversation Data Persisted**: Storage only retains user display settings. Prompts, assistant answers, HTML, and chat metadata are never saved.
- **Local Execution**: Storage remains strictly inside Chrome local storage; no telemetry or remote APIs are called.

---

## Options Page UI

The options page at `src/ui/options/options.html` provides a clean, responsive interface:
- Auto-populates current settings on load.
- Validates user input and displays visual status messages for success or errors.
- Action buttons for **Save Settings** and **Reset to Defaults**.
