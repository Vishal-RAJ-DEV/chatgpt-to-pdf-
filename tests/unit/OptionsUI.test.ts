/**
 * Unit Tests — Options UI Form Controller (Phase 5).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';
import { SettingsManager } from '../../src/core/settings/SettingsManager';
import { OptionsUI } from '../../src/ui/options/options';

describe('Options UI Controller', () => {
  let mockStorageStore: Record<string, unknown> = {};

  beforeEach(() => {
    mockStorageStore = {};

    // Mock chrome storage
    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: { lastError: undefined },
      storage: {
        local: {
          get: vi.fn((_keys: string[], callback: (res: Record<string, unknown>) => void) => callback(mockStorageStore)),
          set: vi.fn((items: Record<string, unknown>, callback: () => void) => {
            Object.assign(mockStorageStore, items);
            if (callback) callback();
          }),
        },
      },
    };

    // Set up DOM fixture matching options.html
    document.body.innerHTML = `
      <form id="settings-form">
        <select id="pageSize"><option value="A4">A4</option><option value="LETTER">LETTER</option></select>
        <select id="orientation"><option value="portrait">portrait</option><option value="landscape">landscape</option></select>
        <input type="text" id="marginTop" value="18mm">
        <input type="text" id="marginRight" value="18mm">
        <input type="text" id="marginBottom" value="18mm">
        <input type="text" id="marginLeft" value="18mm">
        <input type="text" id="fontFamily" value="sans-serif">
        <input type="text" id="baseFontSize" value="10pt">
        <input type="number" id="lineHeight" value="1.5">
        <input type="checkbox" id="showUserMessages" checked>
        <input type="checkbox" id="showAssistantMessages" checked>
        <input type="checkbox" id="showConversationTitle" checked>
        <input type="checkbox" id="showDate" checked>
        <input type="checkbox" id="showFooterPageNumbers" checked>
        <select id="codeTheme"><option value="dark">dark</option><option value="light">light</option></select>
        <input type="checkbox" id="headingSpacing" checked>
        <div id="status-message"></div>
        <button type="button" id="save-btn">Save</button>
        <button type="button" id="reset-btn">Reset</button>
      </form>
    `;
  });

  it('1. populates form inputs with given settings', () => {
    const ui = new OptionsUI(new SettingsManager());
    ui.populateForm({
      ...DEFAULT_SETTINGS,
      pageSize: 'LETTER',
      codeTheme: 'light',
      showUserMessages: false,
    });

    const pageSizeSelect = document.getElementById('pageSize') as HTMLSelectElement;
    const codeThemeSelect = document.getElementById('codeTheme') as HTMLSelectElement;
    const showUserMsgCheck = document.getElementById('showUserMessages') as HTMLInputElement;

    expect(pageSizeSelect.value).toBe('LETTER');
    expect(codeThemeSelect.value).toBe('light');
    expect(showUserMsgCheck.checked).toBe(false);
  });

  it('2. reads current form values into plain object', () => {
    const ui = new OptionsUI(new SettingsManager());
    const pageSizeSelect = document.getElementById('pageSize') as HTMLSelectElement;
    pageSizeSelect.value = 'LETTER';

    const values = ui.readForm();
    expect(values.pageSize).toBe('LETTER');
    expect(values.showUserMessages).toBe(true);
  });

  it('3. initializes UI by loading persisted settings', async () => {
    const manager = new SettingsManager();
    await manager.saveSettings({
      ...DEFAULT_SETTINGS,
      orientation: 'landscape',
    });

    const ui = new OptionsUI(manager);
    await ui.init();

    const orientationSelect = document.getElementById('orientation') as HTMLSelectElement;
    expect(orientationSelect.value).toBe('landscape');
  });

  it('4. saves validated settings when handleSave is called', async () => {
    const manager = new SettingsManager();
    const ui = new OptionsUI(manager);

    const pageSizeSelect = document.getElementById('pageSize') as HTMLSelectElement;
    pageSizeSelect.value = 'LETTER';

    await ui.handleSave();

    const loaded = await manager.loadSettings();
    expect(loaded.pageSize).toBe('LETTER');

    const statusEl = document.getElementById('status-message');
    expect(statusEl?.textContent).toContain('saved successfully');
    expect(statusEl?.className).toContain('success');
  });

  it('5. resets form inputs and storage to default when handleReset is called', async () => {
    const manager = new SettingsManager();
    await manager.saveSettings({
      ...DEFAULT_SETTINGS,
      pageSize: 'LETTER',
    });

    const ui = new OptionsUI(manager);
    const pageSizeSelect = document.getElementById('pageSize') as HTMLSelectElement;
    pageSizeSelect.value = 'LETTER';

    await ui.handleReset();

    expect(pageSizeSelect.value).toBe('A4');

    const statusEl = document.getElementById('status-message');
    expect(statusEl?.textContent).toContain('reset to defaults');
    expect(statusEl?.className).toContain('success');
  });
});
