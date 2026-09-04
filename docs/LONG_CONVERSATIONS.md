# Long Conversations & Virtualized DOM Handling — Phase 7

## Overview

ChatGPT dynamically mounts and unmounts conversation message turns (`[data-testid^="conversation-turn-"]`) as users scroll through lengthy conversation sessions. For long chats, the DOM nodes visible in the active viewport at any given moment represent only a windowed subset of the full conversation history:

$$\text{Visible DOM Nodes} \neq \text{Complete Conversation History}$$

The ChatGPT PDF Exporter implements a dedicated virtualization-aware traversal layer (`ConversationScroller` & `LongConversationExtractor`) to collect all historical turns reliably before rendering printable HTML documents.

---

## Architecture & Data Flow

```
ChatGPT DOM
    ↓
ConversationScroller
  - Locates scroll container (`[data-testid="conversation-turns-container"]` or scroll overflow ancestor)
  - Captures initial user scroll position (`scrollTop`)
  - Executes incremental scrolling (-400px steps upwards to top, then downwards)
  - Monitors DOM mutation events via MutationObserver
    ↓
LongConversationExtractor
  - Extracts turn content per step using ChatGPTAdapter & RichContentExtractor
  - Performs deterministic turn deduplication (data-message-id > data-testid > content hash)
  - Reconstructs original chronological sequence based on turn index hints
  - Enforces safety duration & iteration limits
  - Restores original user scroll position
    ↓
Normalized Conversation Model (metadata.completeness = 'complete')
    ↓
DocumentRenderer → SettingsManager → PrintService
```

---

## Key Components

### 1. `ConversationScroller` (`src/adapters/chatgpt/ConversationScroller.ts`)
- **Scroll Container Discovery**: Scans `chatGPTSelectors.conversationContainer` (`[data-testid="conversation-turns-container"]`) and parent elements for vertical scroll overflow (`overflowY: auto | scroll`).
- **Position Capture & Restoration**: Remembers `scrollTop` prior to traversal and restores it in a `finally` block upon completion or exception.
- **DOM Mutation Watching**: Uses `MutationObserver` to await node insertions/replacements on scroll steps with a bounded fallback timeout.

### 2. `LongConversationExtractor` (`src/core/conversation/LongConversationExtractor.ts`)
- **Deterministic Deduplication**:
  1. `data-message-id` attribute (Primary)
  2. `data-testid` attribute (e.g. `conversation-turn-1`)
  3. `role` + djb2 content fingerprint hash (Fallback)
- **Chronological Order Reconstruction**: Sorts discovered turn records by numeric index hint parsed from `conversation-turn-N` or discovery sequence.
- **Safety Limits & Timeouts**:
  - `maxDurationMs`: 20,000ms
  - `maxIterations`: 60 scroll steps
  - `maxStagnantIterations`: 5 steps without discovering new turns
  - Throws `INCOMPLETE_CONVERSATION` / `LONG_CONVERSATION_TIMEOUT` if limits are exceeded before full history is verified.

---

## Failure Modes & Error Codes

| Error Code | Trigger Condition | User Message |
| :--- | :--- | :--- |
| `STREAMING_IN_PROGRESS` | Assistant is actively generating | "ChatGPT is still generating a response. Wait until it finishes." |
| `CONVERSATION_INCOMPLETE` | Virtualization traversal timed out or stagnant | "Could not collect the complete conversation. Please try again." |
| `UNSUPPORTED_HOST` | Page domain is not `chatgpt.com` | "Open a ChatGPT conversation first." |

---

## Security & Privacy Guarantees

- **No DOM Alteration**: Traversal only scrolls and inspects DOM nodes. It never deletes, modifies, or injects content into the ChatGPT UI.
- **Zero Content Persistence**: Collected conversation text is used strictly to produce printable HTML in memory and is never saved to `chrome.storage` or external servers.
