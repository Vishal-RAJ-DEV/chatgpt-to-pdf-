/**
 * Unit Tests — Settings Storage & Persistence Engine (Phase 5).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';
import { CURRENT_SETTINGS_VERSION, UserSettings } from '../../src/core/settings/Settings';
import { migrateSettings, SettingsManager, STORAGE_KEY } from '../../src/core/settings/SettingsManager';

describe('Settings Storage & Persistence Manager', () => {
  let mockStorageStore: Record<string, unknown> = {};

  beforeEach(() => {
    mockStorageStore = {};

    // Mock global chrome.storage.local & chrome.runtime
    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: {
        lastError: undefined,
      },
      storage: {
        local: {
          get: vi.fn((keys: string[], callback: (result: Record<string, unknown>) => void) => {
            const result: Record<string, unknown> = {};
            for (const key of keys) {
              if (key in mockStorageStore) {
                result[key] = mockStorageStore[key];
              }
            }
            callback(result);
          }),
          set: vi.fn((items: Record<string, unknown>, callback: () => void) => {
            Object.assign(mockStorageStore, items);
            if (callback) callback();
          }),
        },
      },
    };
  });

  it('1. loads DEFAULT_SETTINGS when chrome.storage is empty', async () => {
    const manager = new SettingsManager();
    const settings = await manager.loadSettings();

    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('2. saves settings wrapped under versioned schema', async () => {
    const manager = new SettingsManager();
    const customSettings: UserSettings = {
      ...DEFAULT_SETTINGS,
      pageSize: 'LETTER',
      codeTheme: 'light',
    };

    const saved = await manager.saveSettings(customSettings);
    expect(saved.pageSize).toBe('LETTER');
    expect(saved.codeTheme).toBe('light');

    const rawInStorage = mockStorageStore[STORAGE_KEY] as Record<string, unknown>;
    expect(rawInStorage).toBeDefined();
    expect(rawInStorage.version).toBe(CURRENT_SETTINGS_VERSION);
    expect((rawInStorage.values as UserSettings).pageSize).toBe('LETTER');
  });

  it('3. loads persisted settings from versioned storage', async () => {
    const manager = new SettingsManager();
    const customSettings: UserSettings = {
      ...DEFAULT_SETTINGS,
      orientation: 'landscape',
      lineHeight: 1.8,
    };

    await manager.saveSettings(customSettings);

    const loaded = await manager.loadSettings();
    expect(loaded.orientation).toBe('landscape');
    expect(loaded.lineHeight).toBe(1.8);
  });

  it('4. resets settings back to DEFAULT_SETTINGS', async () => {
    const manager = new SettingsManager();
    await manager.saveSettings({
      ...DEFAULT_SETTINGS,
      pageSize: 'LETTER',
      showUserMessages: false,
    });

    const resetResult = await manager.resetSettings();
    expect(resetResult).toEqual(DEFAULT_SETTINGS);

    const loadedAfterReset = await manager.loadSettings();
    expect(loadedAfterReset).toEqual(DEFAULT_SETTINGS);
  });

  it('5. updates settings partially', async () => {
    const manager = new SettingsManager();
    await manager.saveSettings(DEFAULT_SETTINGS);

    const updated = await manager.updateSettings({
      codeTheme: 'light',
      marginTop: '25mm',
    });

    expect(updated.codeTheme).toBe('light');
    expect(updated.marginTop).toBe('25mm');
    expect(updated.pageSize).toBe(DEFAULT_SETTINGS.pageSize);
  });

  it('6. handles legacy or corrupt stored data safely', () => {
    // Unwrapped flat object fallback
    const legacyData = { pageSize: 'LETTER', orientation: 'landscape' };
    const migratedLegacy = migrateSettings(legacyData);
    expect(migratedLegacy.pageSize).toBe('LETTER');
    expect(migratedLegacy.orientation).toBe('landscape');
    expect(migratedLegacy.marginTop).toBe(DEFAULT_SETTINGS.marginTop);

    // Completely corrupt data
    const corruptData = { version: 1, values: 'invalid-string-instead-of-object' };
    const migratedCorrupt = migrateSettings(corruptData);
    expect(migratedCorrupt).toEqual(DEFAULT_SETTINGS);
  });
});
