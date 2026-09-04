/**
 * Extension Popup UI Controller — Phase 6.1.
 *
 * Handles active-tab ChatGPT conversation detection, export button action triggers,
 * progress feedback, error reporting, and navigation to settings page.
 *
 * Tab detection uses checkConversationReady() which queries the content script health
 * check to distinguish: supported conversation page, ChatGPT non-conversation page,
 * and unsupported sites.
 */

import { ExportService } from '../../core/export/ExportService';

export class PopupUI {
  private exportService: ExportService;
  private isExporting: boolean = false;

  constructor(exportService?: ExportService) {
    this.exportService = exportService || new ExportService();
  }

  public getElement<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
  }

  public updateBadge(text: string, type: 'info' | 'success' | 'warn' | 'error'): void {
    const badge = this.getElement<HTMLSpanElement>('status-badge');
    if (!badge) return;
    badge.textContent = text;
    badge.className = `badge badge-${type}`;
  }

  public showStatus(message: string, type: 'info' | 'success' | 'warn' | 'error'): void {
    const statusBox = this.getElement<HTMLDivElement>('status-box');
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = `status-box ${type}`;
  }

  public hideStatus(): void {
    const statusBox = this.getElement<HTMLDivElement>('status-box');
    if (statusBox) {
      statusBox.textContent = '';
      statusBox.className = 'status-box';
    }
  }

  public setExportButtonEnabled(enabled: boolean): void {
    const exportBtn = this.getElement<HTMLButtonElement>('export-btn');
    if (exportBtn) {
      exportBtn.disabled = !enabled;
    }
  }

  public async init(): Promise<void> {
    this.updateBadge('Checking page…', 'info');

    try {
      // Use health-check-backed detection to distinguish:
      //   'conversation' — export-ready ChatGPT conversation
      //   'chatgpt'      — ChatGPT host but no detectable conversation
      //   'unsupported'  — not chatgpt.com at all
      const readiness = await this.exportService.checkConversationReady();

      switch (readiness) {
        case 'conversation':
          this.updateBadge('Ready — ChatGPT conversation', 'success');
          this.setExportButtonEnabled(true);
          break;
        case 'chatgpt':
          this.updateBadge('ChatGPT (no conversation)', 'warn');
          this.setExportButtonEnabled(false);
          this.showStatus('Open a ChatGPT conversation to export.', 'info');
          break;
        case 'unsupported':
        default:
          this.updateBadge('Unsupported page', 'error');
          this.setExportButtonEnabled(false);
          this.showStatus('Navigate to a ChatGPT conversation to export.', 'info');
          break;
      }
    } catch {
      this.updateBadge('Error checking page', 'error');
      this.setExportButtonEnabled(false);
      this.showStatus('Could not determine conversation readiness.', 'error');
    }

    const exportBtn = this.getElement<HTMLButtonElement>('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExport());
    }

    const settingsBtn = this.getElement<HTMLButtonElement>('open-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        }
      });
    }
  }

  public async handleExport(): Promise<void> {
    if (this.isExporting) {
      return;
    }

    this.isExporting = true;
    const exportBtn = this.getElement<HTMLButtonElement>('export-btn');
    if (exportBtn) exportBtn.disabled = true;

    this.hideStatus();

    try {
      const result = await this.exportService.exportCurrentTab((state) => {
        switch (state) {
          case 'extracting':
            this.showStatus('Extracting conversation…', 'info');
            break;
          case 'rendering':
            this.showStatus('Preparing printable document…', 'info');
            break;
          case 'printing':
            this.showStatus('Opening print dialog…', 'info');
            break;
        }
      });

      if (result.success) {
        if (result.state === 'warning') {
          this.showStatus(
            'PDF exported with warnings: some conversation content may be incomplete.',
            'warn'
          );
        } else {
          this.showStatus(
            'PDF exported successfully.',
            'success'
          );
        }
      } else {
        const errorMsg = result.errorUserMessage || 'PDF export failed.';
        this.showStatus(errorMsg, 'error');
      }
    } catch {
      this.showStatus('PDF export failed.', 'error');
    } finally {
      this.isExporting = false;
      if (exportBtn) exportBtn.disabled = false;
    }
  }
}


if (typeof document !== 'undefined' && document.getElementById('export-btn')) {
  document.addEventListener('DOMContentLoaded', () => {
    const ui = new PopupUI();
    ui.init();
  });
}
