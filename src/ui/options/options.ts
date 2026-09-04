/**
 * Options Page Controller — Phase 5.
 *
 * Manages Options UI interactions, input validation feedback, settings loading,
 * saving, and resetting without page reloads.
 */

import { CodeTheme, PageOrientation, PageSize, UserSettings } from '../../core/settings/Settings';
import { SettingsManager } from '../../core/settings/SettingsManager';
import { validateSettings } from '../../core/settings/validation';

export class OptionsUI {
  private settingsManager: SettingsManager;

  constructor(settingsManager?: SettingsManager) {
    this.settingsManager = settingsManager || new SettingsManager();
  }

  public getElement<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
  }

  public populateForm(settings: UserSettings): void {
    const pageSize = this.getElement<HTMLSelectElement>('pageSize');
    if (pageSize) pageSize.value = settings.pageSize;

    const orientation = this.getElement<HTMLSelectElement>('orientation');
    if (orientation) orientation.value = settings.orientation;

    const marginTop = this.getElement<HTMLInputElement>('marginTop');
    if (marginTop) marginTop.value = settings.marginTop;

    const marginRight = this.getElement<HTMLInputElement>('marginRight');
    if (marginRight) marginRight.value = settings.marginRight;

    const marginBottom = this.getElement<HTMLInputElement>('marginBottom');
    if (marginBottom) marginBottom.value = settings.marginBottom;

    const marginLeft = this.getElement<HTMLInputElement>('marginLeft');
    if (marginLeft) marginLeft.value = settings.marginLeft;

    const fontFamily = this.getElement<HTMLInputElement>('fontFamily');
    if (fontFamily) fontFamily.value = settings.fontFamily;

    const baseFontSize = this.getElement<HTMLInputElement>('baseFontSize');
    if (baseFontSize) baseFontSize.value = settings.baseFontSize;

    const lineHeight = this.getElement<HTMLInputElement>('lineHeight');
    if (lineHeight) lineHeight.value = String(settings.lineHeight);

    const showUserMessages = this.getElement<HTMLInputElement>('showUserMessages');
    if (showUserMessages) showUserMessages.checked = settings.showUserMessages;

    const showAssistantMessages = this.getElement<HTMLInputElement>('showAssistantMessages');
    if (showAssistantMessages) showAssistantMessages.checked = settings.showAssistantMessages;

    const showConversationTitle = this.getElement<HTMLInputElement>('showConversationTitle');
    if (showConversationTitle) showConversationTitle.checked = settings.showConversationTitle;

    const showDate = this.getElement<HTMLInputElement>('showDate');
    if (showDate) showDate.checked = settings.showDate;

    const showRoleLabels = this.getElement<HTMLInputElement>('showRoleLabels');
    if (showRoleLabels) showRoleLabels.checked = settings.showRoleLabels;

    const showConversationSource = this.getElement<HTMLInputElement>('showConversationSource');
    if (showConversationSource) showConversationSource.checked = settings.showConversationSource;

    const showFooterPageNumbers = this.getElement<HTMLInputElement>('showFooterPageNumbers');
    if (showFooterPageNumbers) showFooterPageNumbers.checked = settings.showFooterPageNumbers;

    const codeTheme = this.getElement<HTMLSelectElement>('codeTheme');
    if (codeTheme) codeTheme.value = settings.codeTheme;

    const headingSpacing = this.getElement<HTMLInputElement>('headingSpacing');
    if (headingSpacing) headingSpacing.checked = settings.headingSpacing;
  }

  public readForm(): Record<string, unknown> {
    return {
      pageSize: this.getElement<HTMLSelectElement>('pageSize')?.value as PageSize,
      orientation: this.getElement<HTMLSelectElement>('orientation')?.value as PageOrientation,
      marginTop: this.getElement<HTMLInputElement>('marginTop')?.value,
      marginRight: this.getElement<HTMLInputElement>('marginRight')?.value,
      marginBottom: this.getElement<HTMLInputElement>('marginBottom')?.value,
      marginLeft: this.getElement<HTMLInputElement>('marginLeft')?.value,

      fontFamily: this.getElement<HTMLInputElement>('fontFamily')?.value,
      baseFontSize: this.getElement<HTMLInputElement>('baseFontSize')?.value,
      lineHeight: this.getElement<HTMLInputElement>('lineHeight')?.value,

      showUserMessages: Boolean(this.getElement<HTMLInputElement>('showUserMessages')?.checked),
      showAssistantMessages: Boolean(this.getElement<HTMLInputElement>('showAssistantMessages')?.checked),
      showConversationTitle: Boolean(this.getElement<HTMLInputElement>('showConversationTitle')?.checked),
      showDate: Boolean(this.getElement<HTMLInputElement>('showDate')?.checked),
      showRoleLabels: Boolean(this.getElement<HTMLInputElement>('showRoleLabels')?.checked),
      showConversationSource: Boolean(this.getElement<HTMLInputElement>('showConversationSource')?.checked),
      showFooterPageNumbers: Boolean(this.getElement<HTMLInputElement>('showFooterPageNumbers')?.checked),

      codeTheme: this.getElement<HTMLSelectElement>('codeTheme')?.value as CodeTheme,
      headingSpacing: Boolean(this.getElement<HTMLInputElement>('headingSpacing')?.checked),
    };
  }

  public showStatus(message: string, type: 'success' | 'error'): void {
    const statusEl = this.getElement<HTMLDivElement>('status-message');
    if (!statusEl) return;

    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
  }

  public async init(): Promise<void> {
    try {
      const settings = await this.settingsManager.loadSettings();
      this.populateForm(settings);
    } catch (err) {
      this.showStatus('Failed to load persisted settings.', 'error');
    }

    const saveBtn = this.getElement<HTMLButtonElement>('save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.handleSave());
    }

    const resetBtn = this.getElement<HTMLButtonElement>('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.handleReset());
    }
  }

  public async handleSave(): Promise<void> {
    try {
      const rawFormValues = this.readForm();
      const validated = validateSettings(rawFormValues);

      // Save validated settings to storage
      const saved = await this.settingsManager.saveSettings(validated);

      // Re-populate UI to keep form synchronized with validated values
      this.populateForm(saved);
      this.showStatus('Settings saved successfully.', 'success');
    } catch (err) {
      this.showStatus('Error saving settings.', 'error');
    }
  }

  public async handleReset(): Promise<void> {
    try {
      const defaults = await this.settingsManager.resetSettings();
      this.populateForm(defaults);
      this.showStatus('Settings reset to defaults.', 'success');
    } catch (err) {
      this.showStatus('Error resetting settings.', 'error');
    }
  }
}

if (typeof document !== 'undefined' && document.getElementById('settings-form')) {
  document.addEventListener('DOMContentLoaded', () => {
    const ui = new OptionsUI();
    ui.init();
  });
}
