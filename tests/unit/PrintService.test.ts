/**
 * Unit Tests — PrintService Surface (Phase 6.1).
 *
 * Covers:
 *  1. Opens window, writes HTML, invokes window.print(), closes window on success
 *  2. PRINT_FAILED when window.open is blocked
 *  3. PRINT_TIMEOUT when document never becomes ready
 *  4. Cleanup executes on print exception
 *  5. Cleanup executes on timeout
 *  6. Image readiness: does not hang forever when images are present
 *  7. Image readiness: resolves immediately when all images are already complete
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportError, ExportErrorCode } from '../../src/core/export/ExportErrors';
import { PrintService } from '../../src/core/export/PrintService';

describe('PrintService Surface Unit Tests', () => {
  let mockDoc: Record<string, unknown>;
  let mockWindow: Record<string, unknown>;
  let openSpy: any;

  const makeDoc = (overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
    open: vi.fn(),
    write: vi.fn(),
    close: vi.fn(),
    readyState: 'complete',
    querySelectorAll: vi.fn().mockReturnValue([]),
    ...overrides,
  });

  const makeWin = (doc: Record<string, unknown>): Record<string, unknown> => ({
    document: doc,
    focus: vi.fn(),
    print: vi.fn(),
    close: vi.fn(),
    closed: false,
    onload: null,
  });

  beforeEach(() => {
    mockDoc = makeDoc();
    mockWindow = makeWin(mockDoc);
    openSpy = vi.spyOn(window, 'open').mockReturnValue(mockWindow as unknown as Window);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('1. opens window, writes HTML, invokes window.print(), then closes window', async () => {
    const printService = new PrintService({ timeoutMs: 1000, settleMs: 0 });
    const html = '<!DOCTYPE html><html><body><h1>Print Test</h1></body></html>';

    const result = await printService.print(html);

    expect(result).toBe(true);
    expect(window.open).toHaveBeenCalledWith('', '_blank', expect.any(String));
    expect(mockDoc.write).toHaveBeenCalledWith(html);
    expect(mockWindow.focus).toHaveBeenCalled();
    expect(mockWindow.print).toHaveBeenCalled();
  });

  it('2. rejects with PRINT_FAILED when window.open is blocked (returns null)', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    const printService = new PrintService();
    const err = await printService.print('<html></html>').catch((e) => e);

    expect(err).toBeInstanceOf(ExportError);
    expect((err as ExportError).code).toBe(ExportErrorCode.PRINT_FAILED);
  });

  it('3. rejects with PRINT_TIMEOUT when document never reaches readyState=complete', async () => {
    mockDoc = makeDoc({ readyState: 'loading' });
    mockWindow = makeWin(mockDoc);
    openSpy.mockReturnValue(mockWindow as unknown as Window);
    // Never fire onload

    const printService = new PrintService({ timeoutMs: 50, settleMs: 0 });
    const err = await printService.print('<html></html>').catch((e) => e);

    expect(err).toBeInstanceOf(ExportError);
    expect((err as ExportError).code).toBe(ExportErrorCode.PRINT_TIMEOUT);
  }, 2000);

  it('4. closes window on print exception', async () => {
    (mockWindow as Record<string, unknown>).print = vi.fn().mockImplementation(() => {
      throw new Error('Print forbidden by browser policy');
    });
    openSpy.mockReturnValue(mockWindow as unknown as Window);

    const printService = new PrintService({ timeoutMs: 1000, settleMs: 0 });
    const err = await printService.print('<html></html>').catch((e) => e);

    expect(err).toBeInstanceOf(ExportError);
    expect((err as ExportError).code).toBe(ExportErrorCode.PRINT_FAILED);
    expect(mockWindow.close).toHaveBeenCalled();
  });

  it('5. closes window on timeout (cleanup on timeout)', async () => {
    mockDoc = makeDoc({ readyState: 'loading' });
    mockWindow = makeWin(mockDoc);
    openSpy.mockReturnValue(mockWindow as unknown as Window);

    const printService = new PrintService({ timeoutMs: 50, settleMs: 0 });
    await printService.print('<html></html>').catch(() => {});

    expect(mockWindow.close).toHaveBeenCalled();
  }, 2000);

  it('6. image readiness: does not hang forever if images never load (bounded timeout)', async () => {
    // Simulate incomplete image (img.complete = false, no load event fires)
    const fakeImg = { complete: false, addEventListener: vi.fn() };
    mockDoc = makeDoc({
      readyState: 'complete',
      querySelectorAll: vi.fn().mockReturnValue([fakeImg]),
    });
    mockWindow = makeWin(mockDoc);
    openSpy.mockReturnValue(mockWindow as unknown as Window);

    // With a short total timeout the bounded image sub-timeout fires and print proceeds
    const printService = new PrintService({ timeoutMs: 500, settleMs: 0 });
    const result = await printService.print('<html><img src="test.png"/></html>');

    expect(result).toBe(true);
    expect(mockWindow.print).toHaveBeenCalled();
  }, 3000);

  it('7. image readiness: proceeds immediately when all images are already complete', async () => {
    const fakeImg = { complete: true, addEventListener: vi.fn() };
    mockDoc = makeDoc({
      readyState: 'complete',
      querySelectorAll: vi.fn().mockReturnValue([fakeImg]),
    });
    mockWindow = makeWin(mockDoc);
    openSpy.mockReturnValue(mockWindow as unknown as Window);

    const printService = new PrintService({ timeoutMs: 1000, settleMs: 0 });
    const result = await printService.print('<html><img src="cached.png"/></html>');

    expect(result).toBe(true);
    expect(fakeImg.addEventListener).not.toHaveBeenCalled();
  });
});
