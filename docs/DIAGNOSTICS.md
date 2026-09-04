# ChatGPT PDF Exporter — Resilience, Diagnostics & Failure Handling Architecture

## Overview
Phase 9 introduces local-only diagnostics, structured failure codes, graceful renderer fallbacks, and partial extraction handling across all layers of the extension.

## Privacy Guarantees
- **100% Local Processing**: All diagnostic entries, error messages, and log records remain completely client-side.
- **Zero Content Logging**: Diagnostics **NEVER** contain raw prompt text, assistant responses, or private message content. Context objects are strictly restricted to structural metadata (e.g., turn count, block count, error codes, stage names).
- **No Telemetry**: No network requests, analytics, cloud logging, or remote crash reporting services are included.

## Diagnostic Codes
The diagnostic system uses standardized failure codes defined in `src/utils/Diagnostics.ts`:

| Diagnostic Code | Severity | Trigger Description |
| :--- | :--- | :--- |
| `ADAPTER_CONTAINER_NOT_FOUND` | Warning | ChatGPT conversation root container could not be found in DOM. |
| `ADAPTER_MESSAGE_NOT_FOUND` | Warning | Turn element candidate exists but content root could not be discovered. |
| `EXTRACTION_EMPTY_SUSPICIOUS` | Warning | Conversation UI root exists, but 0 turn candidates were extracted. |
| `EXTRACTION_PARTIAL` | Warning | Turns were extracted with unknown author roles or unparseable content blocks. |
| `EXTRACTION_BLOCK_PARSE_FAILED` | Warning | Individual DOM element could not be converted to a ContentBlock model. |
| `RENDER_UNKNOWN_BLOCK` | Warning | Renderer encountered an unhandled or custom ContentBlock variant. |
| `RENDER_UNSAFE_URL` | Warning | URL string contained dangerous scheme (`javascript:`, `data:text/html`). |
| `EXPORT_RENDER_FAILED` | Error | HTML document generation threw an unhandled exception or returned empty output. |
| `EXPORT_PRINT_FAILED` | Error | Browser print surface failed to open or execute print dialog. |
| `SETTINGS_STORAGE_FAILED` | Warning | `chrome.storage.local` API failed or threw an exception during read/write. |
| `SETTINGS_INVALID` | Warning | Stored settings JSON failed validation checks. |

## Partial Export Policy
- **SUCCESS**: Normal export execution when extraction status is `success`.
- **PARTIAL**: Clear warning displayed to the user; export allowed if partial document structure is safe.
- **SUSPICIOUS_EMPTY**: Export blocked with `EXTRACTION_EMPTY_SUSPICIOUS` warning to prevent empty PDF generation.
- **FAILURE**: Export blocked with actionable error message (`CONVERSATION_NOT_FOUND`, `STREAMING_IN_PROGRESS`, etc.).
- **LEGITIMATE_EMPTY**: Empty conversation models allowed for explicit 0-message sessions.

## Renderer Fallback Policy
- Unknown or malformed `ContentBlock` instances render a safe `<p class="fallback-block">` container without crashing the document renderer.
- Unsafe URLs (`javascript:`, `vbscript:`, `data:text/html`) are stripped and sanitized to empty strings.
- Untrusted string properties are HTML-escaped (`&lt;`, `&gt;`, `&quot;`, `&#39;`).

## Developer Debug Mode
Developer debug logging can be controlled locally via `setDebugMode(true)` in `src/utils/logger.ts`.
In production, standard logging remains non-intrusive and non-sensitive.
