# Long Conversations & Virtualized DOM Handling — Phase 7 Final Hardening

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
  - Performs deterministic turn deduplication (data-message-id > data-testid > positional index)
  - Evaluates observable progress evidence on each scroll step (scrollTop, scrollHeight, mounted IDs, count)
  - Enforces fail-closed safety duration & iteration limits
  - Restores original user scroll position in finally block
  - Sets metadata.completeness = 'complete' ONLY when full traversal completes successfully
    ↓
Normalized Conversation Model (metadata.completeness = 'complete')
    ↓
DocumentRenderer → SettingsManager → PrintService
```

---

## Key Rules & Contracts

### 1. Fail-Closed Traversal Completeness
- **Completion Definition**: Traversal reached both top and bottom boundaries AND traversal did not encounter unresolved progress failure AND the extractor did not terminate early due to safety limits.
- **Fail-Closed Principle**: If traversal is uncertain or interrupted, the extractor throws `INCOMPLETE_CONVERSATION` or `LONG_CONVERSATION_TIMEOUT`. It NEVER returns a partial conversation marked `completeness: 'complete'`.

### 2. Evidence-Based Stagnation & Progress
- **Stagnation Is Not Completion**: A lack of newly discovered DOM nodes does NOT prove traversal is finished. The extractor NEVER force-jumps to boundaries (`scrollToTop`/`scrollToBottom`) to break out of stagnation.
- **Observable Progress Evidence**: A scroll step is considered successful if ANY of the following changed:
  1. `scrollTop` changed meaningfully ($\ge 5\text{px}$)
  2. `scrollHeight` changed
  3. Set of mounted turn IDs / test IDs in DOM changed
  4. Number of discovered unique conversation turns increased
- **Unresolved Stagnation**: If no progress occurs for `maxStagnantIterations` consecutive steps, the extractor treats traversal as unresolved and throws `ExtractionError('INCOMPLETE_CONVERSATION')`.

### 3. Message Identity & Deduplication Hierarchy
- **Identity Hierarchy**:
  1. `data-message-id` attribute (Primary)
  2. `data-testid` attribute (e.g. `conversation-turn-1`)
  3. Positional turn index fallback (`turn-1`, `turn-2`)
- **Identical Messages Preserved**: Content fingerprints are NEVER used to overwrite message IDs or merge distinct turns. Two legitimate conversation turns with identical text (e.g. user asks "Hello" twice) at `conversation-turn-1` and `conversation-turn-3` remain TWO distinct messages.
- **Same Message Remounting**: When the viewport shifts and a turn with the same `data-message-id` or `conversation-turn-N` remounts, it is correctly deduplicated to 1 message.

---

## Error Handling & Code Mapping

| Layer | Code | Trigger Condition |
| :--- | :--- | :--- |
| **Extractor Engine** | `LONG_CONVERSATION_TIMEOUT` | Max traversal duration (20,000ms) exceeded before reaching boundary |
| **Extractor Engine** | `INCOMPLETE_CONVERSATION` | Max scroll iterations (60) or stagnant limit (5) reached before boundary |
| **Export Service** | `CONVERSATION_INCOMPLETE` | Maps both `LONG_CONVERSATION_TIMEOUT` and `INCOMPLETE_CONVERSATION` |
| **User UI Message** | `"Could not collect the complete conversation. Please try again."` | Human-readable popup status message |

---

## Security & Privacy Guarantees

- **No DOM Alteration**: Traversal only scrolls and inspects DOM nodes. It never deletes, modifies, or injects content into the ChatGPT UI.
- **Zero Content Persistence**: Collected conversation text is used strictly to produce printable HTML in memory and is never saved to `chrome.storage` or external servers.
