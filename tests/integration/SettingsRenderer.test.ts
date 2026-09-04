/**
 * Integration Tests — Settings -> RenderOptions -> DocumentRenderer Pipeline (Phase 5).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../src/core/conversation/Model';
import { renderConversation } from '../../src/core/renderer/DocumentRenderer';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';
import { SettingsManager } from '../../src/core/settings/SettingsManager';
import { toRenderOptions } from '../../src/core/settings/toRenderOptions';

describe('Settings -> RenderOptions -> DocumentRenderer Integration Pipeline', () => {
  let mockStorageStore: Record<string, unknown> = {};

  beforeEach(() => {
    mockStorageStore = {};
    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: { lastError: undefined },
      storage: {
        local: {
          get: vi.fn((_keys: string[], cb: (res: Record<string, unknown>) => void) => cb(mockStorageStore)),
          set: vi.fn((items: Record<string, unknown>, cb: () => void) => {
            Object.assign(mockStorageStore, items);
            if (cb) cb();
          }),
        },
      },
    };
  });

  const sampleConversation: Conversation = {
    id: 'conv-settings-test',
    title: 'Settings Integration Test',
    url: 'https://chatgpt.com/c/12345',
    createdAt: '2026-09-04T12:00:00Z',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        timestamp: '12:00 PM',
        blocks: [{ type: 'paragraph', text: 'Hello assistant.' }],
      },
      {
        id: 'msg-2',
        role: 'assistant',
        timestamp: '12:01 PM',
        blocks: [
          { type: 'paragraph', text: 'Hello user.' },
          { type: 'code', language: 'typescript', code: 'const x = 42;' },
        ],
      },
    ],
  };

  it('1. reflects saved marginTop setting in rendered CSS print rules', async () => {
    const manager = new SettingsManager();
    await manager.saveSettings({
      ...DEFAULT_SETTINGS,
      marginTop: '25mm',
    });

    const settings = await manager.loadSettings();
    const renderOpts = toRenderOptions(settings);
    const html = renderConversation(sampleConversation, renderOpts);

    expect(html).toContain('margin-top: 25mm;');
  });

  it('2. omits user messages when showUserMessages is false in settings', async () => {
    const manager = new SettingsManager();
    await manager.saveSettings({
      ...DEFAULT_SETTINGS,
      showUserMessages: false,
    });

    const settings = await manager.loadSettings();
    const renderOpts = toRenderOptions(settings);
    const html = renderConversation(sampleConversation, renderOpts);

    expect(html).not.toContain('class="message message-user"');
    expect(html).toContain('class="message message-assistant"');
    expect(html).not.toContain('Hello assistant.');
    expect(html).toContain('Hello user.');
  });

  it('3. sets letter page size in @page CSS rule when pageSize is LETTER in settings', async () => {
    const manager = new SettingsManager();
    await manager.saveSettings({
      ...DEFAULT_SETTINGS,
      pageSize: 'LETTER',
    });

    const settings = await manager.loadSettings();
    const renderOpts = toRenderOptions(settings);
    const html = renderConversation(sampleConversation, renderOpts);

    expect(html).toContain('size: 8.5in 11in;');
  });

  it('4. applies light theme styling to code blocks when codeTheme is light in settings', async () => {
    const manager = new SettingsManager();
    await manager.saveSettings({
      ...DEFAULT_SETTINGS,
      codeTheme: 'light',
    });

    const settings = await manager.loadSettings();
    const renderOpts = toRenderOptions(settings);
    const html = renderConversation(sampleConversation, renderOpts);

    // Light code theme uses #f8fafc for code block background
    expect(html).toContain('background: #f8fafc;');
    expect(html).toContain('const x = 42;');
  });
});
