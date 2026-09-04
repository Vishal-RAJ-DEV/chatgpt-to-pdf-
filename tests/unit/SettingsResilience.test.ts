/**
 * Unit Tests — Settings Resilience & Storage Error Fallbacks (Phase 9).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/core/settings/defaults';
import { SettingsManager } from '../../src/core/settings/SettingsManager';

describe('Settings Storage Resilience & Corrupted State Fallbacks', () => {
  beforeEach(() => {
    // Reset global chrome mock
    (globalThis as unknown as Record<string, unknown>).chrome = undefined;
  });

  it('1. falls back gracefully to DEFAULT_SETTINGS when storage API throws or is unavailable', async () => {
    const manager = new SettingsManager();
    const settings = await manager.loadSettings();

    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('2. falls back gracefully when chrome.runtime.lastError occurs during load', async () => {
    (globalThis as unknown as Record<string, unknown>).chrome = {
      runtime: { lastError: { message: 'Storage corrupted or quota exceeded' } },
      storage: {
        local: {
          get: vi.fn((_keys: string[], callback: (res: Record<string, unknown>) => void) => {
            callback({});
          }),
        },
      },
    };

    const manager = new SettingsManager();
    const settings = await manager.loadSettings();

    expect(settings.pageSize).toBe(DEFAULT_SETTINGS.pageSize);
    expect(settings.orientation).toBe(DEFAULT_SETTINGS.orientation);
  });
});
