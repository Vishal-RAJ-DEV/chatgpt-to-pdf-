/**
 * Unit Tests — PrintService Surface (Phase 6).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportError } from '../../src/core/export/ExportErrors';
import { PrintService } from '../../src/core/export/PrintService';

describe('PrintService Surface Unit Tests', () => {
  let mockWindow: Record<string, unknown>;
  let mockDoc: Record<string, unknown>;

  beforeEach(() => {
    mockDoc = {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
      readyState: 'complete',
    };

    mockWindow = {
      document: mockDoc,
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
      onload: null,
    };

    vi.spyOn(window, 'open').mockReturnValue(mockWindow as unknown as Window);
  });

  it('1. opens print window, writes HTML, and invokes window.print()', async () => {
    const printService = new PrintService({ timeoutMs: 1000 });
    const sampleHtml = '<!DOCTYPE html><html><body><h1>Print Test</h1></body></html>';

    const resultPromise = printService.print(sampleHtml);

    // Wait for microtask/timer to trigger print
    const result = await resultPromise;

    expect(result).toBe(true);
    expect(window.open).toHaveBeenCalledWith('', '_blank', expect.any(String));
    expect(mockDoc.write).toHaveBeenCalledWith(sampleHtml);
    expect(mockWindow.focus).toHaveBeenCalled();
    expect(mockWindow.print).toHaveBeenCalled();
  });

  it('2. throws ExportError PRINT_FAILED when window.open is blocked', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    const printService = new PrintService();
    await expect(printService.print('<html></html>')).rejects.toThrow(ExportError);
  });

  it('3. times out if print dialog does not ready within timeoutMs', async () => {
    mockDoc.readyState = 'loading';
    // Do not fire onload or set readyState to complete

    const printService = new PrintService({ timeoutMs: 50 });
    await expect(printService.print('<html></html>')).rejects.toThrow(ExportError);
  }, 1000);
});
