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

describe('PopupUI Hardening & Error Boundary Unit Tests', () => {
  it('1. prevents duplicate concurrent export calls when clicked rapidly', async () => {
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

    // Trigger first export call
    const firstCallPromise = popup.handleExport();

    // Trigger second immediate export call while first is still pending
    const secondCallPromise = popup.handleExport();

    // Verify exportCurrentTab was called EXACTLY ONCE
    expect(mockExportService.exportCurrentTab).toHaveBeenCalledTimes(1);

    // Resolve export promise
    resolveExport!({ success: true, state: 'success' });
    await Promise.all([firstCallPromise, secondCallPromise]);

    // Verify button is re-enabled after completion
    const exportBtn = popup.getElement<HTMLButtonElement>('export-btn');
    expect(exportBtn?.disabled).toBe(false);

    // Verify state reset allowing a new export call afterwards
    await popup.handleExport();
    expect(mockExportService.exportCurrentTab).toHaveBeenCalledTimes(2);
  });

  it('2. resets isExporting state and button enabled state in finally block after export failure', async () => {
    setupPopupDom();

    const mockExportService = {
      checkConversationReady: vi.fn().mockResolvedValue('conversation'),
      exportCurrentTab: vi.fn().mockResolvedValue({
        success: false,
        state: 'error',
        errorUserMessage: 'PDF export failed due to render error.',
      }),
    } as unknown as ExportService;

    const popup = new PopupUI(mockExportService);
    await popup.init();

    await popup.handleExport();

    const statusBox = popup.getElement<HTMLDivElement>('status-box');
    expect(statusBox?.textContent).toBe('PDF export failed due to render error.');
    expect(statusBox?.className).toContain('error');

    const exportBtn = popup.getElement<HTMLButtonElement>('export-btn');
    expect(exportBtn?.disabled).toBe(false);

    // Subsequent call should succeed
    await popup.handleExport();
    expect(mockExportService.exportCurrentTab).toHaveBeenCalledTimes(2);
  });

  it('3. handles unexpected ExportService rejection gracefully without getting stuck disabled', async () => {
    setupPopupDom();

    const mockExportService = {
      checkConversationReady: vi.fn().mockResolvedValue('conversation'),
      exportCurrentTab: vi.fn().mockRejectedValue(new Error('Unexpected exception during export')),
    } as unknown as ExportService;

    const popup = new PopupUI(mockExportService);
    await popup.init();

    await popup.handleExport();

    const statusBox = popup.getElement<HTMLDivElement>('status-box');
    expect(statusBox?.textContent).toBe('PDF export failed.');
    expect(statusBox?.className).toContain('error');

    const exportBtn = popup.getElement<HTMLButtonElement>('export-btn');
    expect(exportBtn?.disabled).toBe(false);
  });

  it('4. handles checkConversationReady rejection gracefully during init', async () => {
    setupPopupDom();

    const mockExportService = {
      checkConversationReady: vi.fn().mockRejectedValue(new Error('Tab disconnected')),
      exportCurrentTab: vi.fn(),
    } as unknown as ExportService;

    const popup = new PopupUI(mockExportService);
    await popup.init();

    const badge = popup.getElement<HTMLSpanElement>('status-badge');
    expect(badge?.textContent).toBe('Error checking page');
    expect(badge?.className).toContain('error');

    const exportBtn = popup.getElement<HTMLButtonElement>('export-btn');
    expect(exportBtn?.disabled).toBe(true);

    const statusBox = popup.getElement<HTMLDivElement>('status-box');
    expect(statusBox?.textContent).toBe('Could not determine conversation readiness.');
  });
});
