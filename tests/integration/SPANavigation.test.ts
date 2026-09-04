/**
 * Integration Tests — ChatGPT SPA Navigation & Stale Cache Prevention (Phase 10).
 *
 * Verifies that client-side SPA route transitions (history.pushState / history.replaceState / popstate)
 * between different conversations (A -> B, A -> home -> B, A -> B -> A) do not leak stale cached
 * conversations, and always extract fresh data from the active DOM.
 */

import { describe, expect, it, vi } from 'vitest';
import { extractConversationWithResult } from '../../src/core/conversation/Extractor';
import { ExportService, TabCommunicator } from '../../src/core/export/ExportService';
import { PrintService } from '../../src/core/export/PrintService';
import { SettingsManager } from '../../src/core/settings/SettingsManager';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';

describe('ChatGPT SPA Navigation & Stale Cache Prevention Tests', () => {
  function createTestDom(options: { title: string; userText: string; assistantText: string }): Document {
    const doc = document.implementation.createHTMLDocument(options.title);

    const main = doc.createElement('main');
    const h1 = doc.createElement('h1');
    h1.textContent = options.title;
    main.appendChild(h1);

    const container = doc.createElement('div');
    container.setAttribute('data-testid', 'conversation-turns-container');

    const userTurn = doc.createElement('div');
    userTurn.setAttribute('data-message-author-role', 'user');
    userTurn.setAttribute('data-testid', 'conversation-turn-1');
    const userContent = doc.createElement('div');
    userContent.className = 'whitespace-pre-wrap';
    userContent.textContent = options.userText;
    userTurn.appendChild(userContent);

    const assistantTurn = doc.createElement('div');
    assistantTurn.setAttribute('data-message-author-role', 'assistant');
    assistantTurn.setAttribute('data-testid', 'conversation-turn-2');
    const assistantContent = doc.createElement('div');
    assistantContent.className = 'markdown prose';
    const p = doc.createElement('p');
    p.textContent = options.assistantText;
    assistantContent.appendChild(p);
    assistantTurn.appendChild(assistantContent);

    container.appendChild(userTurn);
    container.appendChild(assistantTurn);
    main.appendChild(container);
    doc.body.appendChild(main);

    return doc;
  }

  it('1. SPA transition A -> B extracts fresh DOM data for B without returning stale A', async () => {
    const docA = createTestDom({
      title: 'Topic A — Quantum Computing',
      userText: 'Explain qubits',
      assistantText: 'Qubits use superposition.',
    });

    const docB = createTestDom({
      title: 'Topic B — Machine Learning',
      userText: 'Explain neural networks',
      assistantText: 'Neural networks use backpropagation.',
    });

    // 1. Extract Conversation A
    const resultA = extractConversationWithResult(docA, '/c/672a1b9e-4c80-8005-9f5b-111111111111');
    expect(resultA.status).toBe('success');
    expect(resultA.conversation?.id).toBe('672a1b9e-4c80-8005-9f5b-111111111111');
    expect(resultA.conversation?.title).toBe('Topic A — Quantum Computing');
    expect(resultA.conversation?.messages[0].blocks[0]).toEqual({ type: 'paragraph', text: 'Explain qubits' });

    // 2. Simulate SPA Navigation to Conversation B
    const resultB = extractConversationWithResult(docB, '/c/672a1b9e-4c80-8005-9f5b-222222222222');
    expect(resultB.status).toBe('success');
    expect(resultB.conversation?.id).toBe('672a1b9e-4c80-8005-9f5b-222222222222');
    expect(resultB.conversation?.title).toBe('Topic B — Machine Learning');
    expect(resultB.conversation?.messages[0].blocks[0]).toEqual({ type: 'paragraph', text: 'Explain neural networks' });

    // Assert zero leakage between A and B
    expect(resultB.conversation?.title).not.toBe(resultA.conversation?.title);
    expect(resultB.conversation?.id).not.toBe(resultA.conversation?.id);
  });

  it('2. SPA transition sequence A -> home -> B extracts cleanly at each step', async () => {
    const docA = createTestDom({
      title: 'Topic A — Physics',
      userText: 'What is mass?',
      assistantText: 'Mass is inertia.',
    });

    const docB = createTestDom({
      title: 'Topic B — Chemistry',
      userText: 'What is an atom?',
      assistantText: 'An atom consists of protons and electrons.',
    });

    // Step 1: Conversation A
    const resA = extractConversationWithResult(docA, '/c/672a1b9e-4c80-8005-9f5b-111111111111');
    expect(resA.status).toBe('success');
    expect(resA.conversation?.id).toBe('672a1b9e-4c80-8005-9f5b-111111111111');

    // Step 2: Home Page (0 turns, default title, no container)
    const docHome = document.implementation.createHTMLDocument('ChatGPT');
    const resHome = extractConversationWithResult(docHome, '/');
    expect(resHome.status).toBe('failure');
    expect(resHome.conversation).toBeNull();

    // Step 3: Conversation B
    const resB = extractConversationWithResult(docB, '/c/672a1b9e-4c80-8005-9f5b-222222222222');
    expect(resB.status).toBe('success');
    expect(resB.conversation?.id).toBe('672a1b9e-4c80-8005-9f5b-222222222222');
    expect(resB.conversation?.title).toBe('Topic B — Chemistry');
  });

  it('3. SPA transition sequence A -> B -> A returns fresh state for A upon return', async () => {
    const docA = createTestDom({
      title: 'Topic A',
      userText: 'User A text',
      assistantText: 'Assistant A text',
    });

    const docB = createTestDom({
      title: 'Topic B',
      userText: 'User B text',
      assistantText: 'Assistant B text',
    });

    // A
    const resA1 = extractConversationWithResult(docA, '/c/672a1b9e-4c80-8005-9f5b-111111111111');
    expect(resA1.conversation?.id).toBe('672a1b9e-4c80-8005-9f5b-111111111111');

    // B
    const resB = extractConversationWithResult(docB, '/c/672a1b9e-4c80-8005-9f5b-222222222222');
    expect(resB.conversation?.id).toBe('672a1b9e-4c80-8005-9f5b-222222222222');

    // Return to A
    const resA2 = extractConversationWithResult(docA, '/c/672a1b9e-4c80-8005-9f5b-111111111111');
    expect(resA2.conversation?.id).toBe('672a1b9e-4c80-8005-9f5b-111111111111');
    expect(resA2.conversation?.title).toBe('Topic A');
  });

  it('4. ExportService messaging receives updated tab URL and current conversation across SPA switches', async () => {
    let currentUrl = 'https://chatgpt.com/c/conv-111';
    let currentDoc = createTestDom({
      title: 'Chat 111',
      userText: 'Hello 111',
      assistantText: 'Response 111',
    });

    const mockCommunicator: TabCommunicator = {
      getActiveTab: vi.fn().mockImplementation(() => Promise.resolve({ id: 555, url: currentUrl })),
      sendMessage: vi.fn().mockImplementation(() => {
        const res = extractConversationWithResult(currentDoc, new URL(currentUrl).pathname);
        return Promise.resolve({
          success: res.status === 'success' || res.status === 'partial',
          result: res,
          conversation: res.conversation,
          status: res.status,
          warnings: res.warnings,
          errors: res.errors,
        });
      }),
    };

    const settingsManager = {
      loadSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
      saveSettings: vi.fn(),
      resetSettings: vi.fn(),
      updateSettings: vi.fn(),
    } as unknown as SettingsManager;

    let printedHtml = '';
    const printService = {
      print: vi.fn().mockImplementation((html: string) => {
        printedHtml = html;
        return Promise.resolve(true);
      }),
    } as unknown as PrintService;

    const exportService = new ExportService(mockCommunicator, settingsManager, printService);

    // Export 1
    const result1 = await exportService.exportCurrentTab();
    expect(result1.success).toBe(true);
    expect(printedHtml).toContain('Chat 111');

    // SPA Navigation to 222
    currentUrl = 'https://chatgpt.com/c/conv-222';
    currentDoc = createTestDom({
      title: 'Chat 222',
      userText: 'Hello 222',
      assistantText: 'Response 222',
    });

    // Export 2
    const result2 = await exportService.exportCurrentTab();
    expect(result2.success).toBe(true);
    expect(printedHtml).toContain('Chat 222');
    expect(printedHtml).not.toContain('Chat 111');
  });
});
