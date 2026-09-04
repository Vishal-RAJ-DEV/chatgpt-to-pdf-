import { describe, expect, it, vi } from 'vitest';
import { ExportService } from '../../src/core/export/ExportService';
import { PopupUI } from '../../src/ui/popup/popup';

function setupPopupDom(): void {
  document.body.innerHTML = `
    <span id="status-badge" class="badge badge-info">Checking page...</span>
    <button id="export-btn" class="btn btn-primary" disabled>Export as PDF</button>
    <button id="open-settings" class="btn btn-secondary">Settings</button>
    <div id="status-box" class="status-box" aria-live="polite"></div>
  `;
}

describe('State Race Conditions & Popup UI Reliability Unit Tests', () => {
  it('1. updates button text to "Exporting…" and sets aria-busy="true" during active export', async () => {
    setupPopupDom();

    let resolveExport: (val: any) => void;
    const exportPromise = new Promise<any>((resolve) => {
      resolveExport = resolve;
    });

    const mockExportService = {
      checkConversationReady: vi.fn().mockResolvedValue('conversation'),
      exportCurrentTab: vi.fn().mockReturnValue(exportPromise),
    } as unknown as ExportService;

    const popup = new PopupUI(mockExportService);
    await popup.init();

    const exportBtn = popup.getElement<HTMLButtonElement>('export-btn')!;

    // Start export
    const handlePromise = popup.handleExport();

    expect(exportBtn.disabled).toBe(true);
    expect(exportBtn.textContent).toBe('Exporting…');
    expect(exportBtn.getAttribute('aria-busy')).toBe('true');

    // Finish export
    resolveExport!({ success: true, state: 'success' });
    await handlePromise;

    expect(exportBtn.disabled).toBe(false);
    expect(exportBtn.textContent).toBe('Export as PDF');
    expect(exportBtn.getAttribute('aria-busy')).toBeNull();
  });

  it('2. propagates partial extraction warnings to user status box', async () => {
    setupPopupDom();

    const mockExportService = {
      checkConversationReady: vi.fn().mockResolvedValue('conversation'),
      exportCurrentTab: vi.fn().mockResolvedValue({
        success: true,
        state: 'warning',
        extractionStatus: 'partial',
        warnings: [{ code: 'EXTRACTION_PARTIAL', message: 'Some turns missing' }],
      }),
    } as unknown as ExportService;

    const popup = new PopupUI(mockExportService);
    await popup.init();

    await popup.handleExport();

    const statusBox = popup.getElement<HTMLDivElement>('status-box')!;
    expect(statusBox.textContent).toContain('PDF exported with warnings');
    expect(statusBox.className).toContain('warn');
  });

  it('3. handles content script messaging timeouts without leaving button permanently disabled', async () => {
    setupPopupDom();

    const mockExportService = {
      checkConversationReady: vi.fn().mockResolvedValue('conversation'),
      exportCurrentTab: vi.fn().mockResolvedValue({
        success: false,
        state: 'error',
        errorCode: 'PRINT_TIMEOUT',
        errorUserMessage: 'Print preparation timed out. Please try again.',
      }),
    } as unknown as ExportService;

    const popup = new PopupUI(mockExportService);
    await popup.init();

    await popup.handleExport();

    const statusBox = popup.getElement<HTMLDivElement>('status-box')!;
    expect(statusBox.textContent).toBe('Print preparation timed out. Please try again.');
    expect(statusBox.className).toContain('error');

    const exportBtn = popup.getElement<HTMLButtonElement>('export-btn')!;
    expect(exportBtn.disabled).toBe(false);
    expect(exportBtn.textContent).toBe('Export as PDF');
  });

  it('4. resets to idle state allowing retry after initial export error', async () => {
    setupPopupDom();

    let callCount = 0;
    const mockExportService = {
      checkConversationReady: vi.fn().mockResolvedValue('conversation'),
      exportCurrentTab: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            success: false,
            state: 'error',
            errorUserMessage: 'Temporary extraction failure.',
          });
        }
        return Promise.resolve({
          success: true,
          state: 'success',
        });
      }),
    } as unknown as ExportService;

    const popup = new PopupUI(mockExportService);
    await popup.init();

    // Call 1 -> Fail
    await popup.handleExport();
    let statusBox = popup.getElement<HTMLDivElement>('status-box')!;
    expect(statusBox.textContent).toBe('Temporary extraction failure.');

    // Call 2 -> Retry succeeds
    await popup.handleExport();
    statusBox = popup.getElement<HTMLDivElement>('status-box')!;
    expect(statusBox.textContent).toBe('PDF exported successfully.');
    expect(statusBox.className).toContain('success');
  });
});
