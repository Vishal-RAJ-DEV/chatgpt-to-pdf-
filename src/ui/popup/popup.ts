/**
 * Extension Popup UI Controller — Phase 6.
 *
 * Handles active-tab ChatGPT support detection, export button action triggers,
 * progress feedback, error reporting, and navigation to settings page.
 */

import { ExportService } from '../../core/export/ExportService';

export class PopupUI {
  private exportService: ExportService;

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

  public showStatus(message: string, type: 'info' | 'success' | 'error'): void {
    const statusBox = this.getElement<HTMLDivElement>('status-box');
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.className = `status-box ${type}`;
  }

  public hideStatus(): void {
    const statusBox = this.getElement<HTMLDivElement>('status-box');
    if (statusBox) statusBox.style.display = 'none';
  }

  public setExportButtonEnabled(enabled: boolean): void {
    const exportBtn = this.getElement<HTMLButtonElement>('export-btn');
    if (exportBtn) {
      exportBtn.disabled = !enabled;
    }
  }

  public async init(): Promise<void> {
    const isSupported = await this.exportService.checkSupport();

    if (isSupported) {
      this.updateBadge('Ready on ChatGPT', 'success');
      this.setExportButtonEnabled(true);
    } else {
      this.updateBadge('Unsupported page', 'error');
      this.setExportButtonEnabled(false);
      this.showStatus('Open a ChatGPT conversation to export.', 'info');
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
    const exportBtn = this.getElement<HTMLButtonElement>('export-btn');
    if (exportBtn) exportBtn.disabled = true;

    try {
      const result = await this.exportService.exportCurrentTab((state) => {
        switch (state) {
          case 'extracting':
            this.showStatus('Extracting conversation content...', 'info');
            break;
          case 'rendering':
            this.showStatus('Preparing printable document...', 'info');
            break;
          case 'printing':
            this.showStatus('Opening print dialog...', 'info');
            break;
        }
      });

      if (result.success) {
        this.showStatus('Print dialog opened. Select "Save as PDF" to save your document.', 'success');
      } else {
        const errorMsg = result.errorUserMessage || 'Export failed. Please try again.';
        this.showStatus(errorMsg, 'error');
      }
    } catch (err) {
      this.showStatus('Export failed unexpectedly. Please try again.', 'error');
    } finally {
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
