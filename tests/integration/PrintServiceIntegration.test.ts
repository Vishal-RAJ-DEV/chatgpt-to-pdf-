/**
 * Integration Tests — PrintService Contract & Mocked Lifecycle (Phase 10).
 *
 * Verifies window lifecycle management, HTML payload writing, print execution,
 * error handling, timeout handling, and window/timer cleanup guarantees using
 * a mocked window environment in Vitest.
 */

import { describe, expect, it, vi } from 'vitest';
import { PrintService } from '../../src/core/export/PrintService';
import { ExportError, ExportErrorCode } from '../../src/core/export/ExportErrors';

describe('PrintService Contract & Mocked Lifecycle Tests (Vitest Simulation)', () => {
  function setupMockWindow(options?: {
    blockPopup?: boolean;
    readyState?: 'complete' | 'loading';
    throwOnPrint?: boolean;
  }) {
    let closedState = false;
    const mockDocument = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      readyState: options?.readyState ?? 'complete',
      querySelectorAll: vi.fn().mockReturnValue([]),
    };

    const mockPrintWin = {
      document: mockDocument,
      focus: vi.fn(),
      print: vi.fn().mockImplementation(() => {
        if (options?.throwOnPrint) {
          throw new Error('Print execution failed in browser');
        }
      }),
      close: vi.fn().mockImplementation(() => {
        closedState = true;
      }),
      get closed() {
        return closedState;
      },
      onload: null as (() => void) | null,
    };

    const openMock = vi.fn().mockImplementation(() => {
      if (options?.blockPopup) return null;
      return mockPrintWin;
    });

    (globalThis as unknown as Record<string, unknown>).window = {
      open: openMock,
    };

    return { openMock, mockPrintWin, mockDocument };
  }

  it('A) successful print creates window, writes HTML, calls print(), and cleans up window', async () => {
    const { openMock, mockPrintWin, mockDocument } = setupMockWindow();
    const service = new PrintService({ timeoutMs: 1000, settleMs: 10 });

    const htmlPayload = '<!DOCTYPE html><html><body><h1>Print Test</h1></body></html>';
    const result = await service.print(htmlPayload);

    expect(result).toBe(true);
    expect(openMock).toHaveBeenCalledWith('', '_blank', expect.any(String));
    expect(mockDocument.write).toHaveBeenCalledWith(htmlPayload);
    expect(mockPrintWin.focus).toHaveBeenCalled();
    expect(mockPrintWin.print).toHaveBeenCalled();

    // Fast-forward window close deferral timer
    await new Promise((r) => setTimeout(r, 1100));
    expect(mockPrintWin.close).toHaveBeenCalled();
  });

  it('B) print timeout closes print surface window and rejects with PRINT_TIMEOUT', async () => {
    const { mockPrintWin } = setupMockWindow({ readyState: 'loading' });
    // Keep readyState loading so onload never fires
    const service = new PrintService({ timeoutMs: 50, settleMs: 10 });

    await expect(service.print('<html></html>')).rejects.toThrowError(ExportError);

    try {
      await service.print('<html></html>');
    } catch (err) {
      const exportErr = err as ExportError;
      expect(exportErr.code).toBe(ExportErrorCode.PRINT_TIMEOUT);
    }

    expect(mockPrintWin.close).toHaveBeenCalled();
  });

  it('C) pop-up blocked throws PRINT_FAILED and cleans up immediately', async () => {
    setupMockWindow({ blockPopup: true });
    const service = new PrintService();

    await expect(service.print('<html></html>')).rejects.toThrowError(ExportError);

    try {
      await service.print('<html></html>');
    } catch (err) {
      const exportErr = err as ExportError;
      expect(exportErr.code).toBe(ExportErrorCode.PRINT_FAILED);
      expect(exportErr.message).toContain('blocked');
    }
  });

  it('D) browser print exception cleans up window and rejects with PRINT_FAILED', async () => {
    const { mockPrintWin } = setupMockWindow({ throwOnPrint: true });
    const service = new PrintService({ timeoutMs: 1000, settleMs: 10 });

    await expect(service.print('<html></html>')).rejects.toThrowError(ExportError);

    try {
      await service.print('<html></html>');
    } catch (err) {
      const exportErr = err as ExportError;
      expect(exportErr.code).toBe(ExportErrorCode.PRINT_FAILED);
    }

    expect(mockPrintWin.close).toHaveBeenCalled();
  });
});
