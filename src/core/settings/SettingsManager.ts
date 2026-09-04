/**
 * Isolated Chrome Storage Settings Manager — Phase 5.
 *
 * Encapsulates chrome.storage.local operations, schema versioning,
 * validation, and default fallback logic.
 */

import { CURRENT_SETTINGS_VERSION, StoredSettings, UserSettings } from './Settings';
import { DEFAULT_SETTINGS } from './defaults';
import { validatePartialSettings, validateSettings } from './validation';
import { logger } from '../../utils/logger';
import { createDiagnosticEntry } from '../../utils/Diagnostics';

export const STORAGE_KEY = 'chatgpt_pdf_exporter_settings';

/**
 * Migration boundary for stored settings versions.
 */

export function migrateSettings(rawStored: unknown): UserSettings {
  if (typeof rawStored !== 'object' || rawStored === null) {
    return validateSettings({});
  }

  const record = rawStored as Record<string, unknown>;

  // Check versioning wrapper
  if ('version' in record && 'values' in record) {
    const version = Number(record.version);
    const values = record.values;

    if (version === CURRENT_SETTINGS_VERSION) {
      return validateSettings(values);
    }

    // Future version migrations can be handled here.
    // For now (version 1), validate and return extracted values.
    return validateSettings(values);
  }

  // Legacy or flat storage fallback
  return validateSettings(rawStored);
}

/**
 * Checks if chrome.storage.local is available in current environment.
 */
function getStorageArea(): typeof chrome.storage.local {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return chrome.storage.local;
  }
  throw new Error('[SettingsManager] chrome.storage.local is not available in current environment.');
}

export class SettingsManager {
  /**
   * Loads settings from chrome.storage.local.
   * If storage is empty or invalid, returns validated DEFAULT_SETTINGS.
   */
  public async loadSettings(): Promise<UserSettings> {
    return new Promise<UserSettings>((resolve) => {
      try {
        const storage = getStorageArea();
        storage.get([STORAGE_KEY], (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            logger.diagnostic(
              createDiagnosticEntry(
                'warning',
                'SETTINGS_STORAGE_FAILED',
                'Chrome storage load failed; falling back to DEFAULT_SETTINGS.',
                { error: chrome.runtime.lastError.message }
              )
            );
            return resolve(validateSettings(DEFAULT_SETTINGS));
          }

          const rawData = result ? result[STORAGE_KEY] : undefined;
          if (!rawData) {
            return resolve(validateSettings(DEFAULT_SETTINGS));
          }

          const migrated = migrateSettings(rawData);
          resolve(migrated);
        });
      } catch (err) {
        logger.diagnostic(
          createDiagnosticEntry(
            'warning',
            'SETTINGS_STORAGE_FAILED',
            'Storage API exception; falling back to DEFAULT_SETTINGS.',
            { error: err instanceof Error ? err.message : String(err) }
          )
        );
        resolve(validateSettings(DEFAULT_SETTINGS));
      }
    });
  }

  /**
   * Validates and saves full UserSettings into chrome.storage.local under versioned wrapper.
   */
  public async saveSettings(settings: UserSettings): Promise<UserSettings> {
    const storage = getStorageArea();
    const validated = validateSettings(settings);

    const storedData: StoredSettings = {
      version: CURRENT_SETTINGS_VERSION,
      values: validated,
    };

    return new Promise<UserSettings>((resolve, reject) => {
      try {
        storage.set({ [STORAGE_KEY]: storedData }, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
          resolve(validated);
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /**
   * Resets settings in storage back to canonical DEFAULT_SETTINGS.
   */
  public async resetSettings(): Promise<UserSettings> {
    return this.saveSettings(validateSettings(DEFAULT_SETTINGS));
  }

  /**
   * Applies partial update to persisted settings.
   */
  public async updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.loadSettings();
    const validatedPartial = validatePartialSettings(partial);
    const merged = { ...current, ...validatedPartial };
    return this.saveSettings(merged);
  }
}
