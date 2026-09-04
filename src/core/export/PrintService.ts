/**
 * Local Print Surface Service — Phase 6.1.
 *
 * Encapsulates browser print surface creation (window.open / document write)
 * and window.print() execution behind an isolated service layer.
 *
 * Lifecycle:
 *   create window → write HTML → wait for image readiness → invoke print → cleanup
 *
 * Cleanup is guaranteed on: successful print, print exception, readiness timeout,
 * and any unexpected exception.
 *
 * Browser limitation note:
 *   window.print() is synchronous but the print dialog close is not observable.
 *   We report "print dialog opened" rather than "PDF saved" because the extension
 *   cannot determine whether the user clicked Save or cancelled.
 */

import { ExportError, ExportErrorCode } from './ExportErrors';

export interface PrintWindowOptions {
  /** Total timeout (ms) to wait for document + image readiness before aborting. Default: 5000 */
  timeoutMs?: number;
  /** Extra settle delay (ms) after readiness before invoking window.print(). Default: 100 */
  settleMs?: number;
}

export class PrintService {
  private timeoutMs: number;
  private settleMs: number;

  constructor(options?: PrintWindowOptions) {
    this.timeoutMs = options?.timeoutMs ?? 5000;
    this.settleMs = options?.settleMs ?? 100;
  }

  /**
   * Opens standalone HTML in a temporary print surface and triggers native browser print dialog.
   * Guarantees cleanup of the print window on every exit path.
   */
  public async print(html: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      throw new ExportError(ExportErrorCode.PRINT_FAILED, 'Window environment unavailable for printing.');
    }

    return new Promise<boolean>((resolve, reject) => {
      let printWin: Window | null = null;
      let globalTimer: ReturnType<typeof setTimeout> | null = null;

      const closeWindow = () => {
        try {
          if (printWin && !printWin.closed) {
            printWin.close();
          }
        } catch {
          // Cannot close cross-origin windows; ignore silently
        }
        printWin = null;
      };

      const clearGlobalTimer = () => {
        if (globalTimer !== null) {
          clearTimeout(globalTimer);
          globalTimer = null;
        }
      };

      const failWith = (err: ExportError) => {
        clearGlobalTimer();
        closeWindow();
        reject(err);
      };

      const succeed = () => {
        clearGlobalTimer();
        // Defer close slightly so the print dialog can fully appear before window closes.
        // Some browsers dismiss the print dialog if the opener window closes too quickly.
        setTimeout(closeWindow, 1000);
        resolve(true);
      };

      try {
        // Create isolated print surface window
        printWin = window.open('', '_blank', 'width=800,height=900,top=100,left=100');

        if (!printWin) {
          throw new ExportError(ExportErrorCode.PRINT_FAILED, 'Pop-up print surface was blocked by browser.');
        }

        // Write complete standalone rendered HTML document
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();

        // Global bounded timeout covering all async steps
        globalTimer = setTimeout(() => {
          globalTimer = null;
          failWith(new ExportError(ExportErrorCode.PRINT_TIMEOUT));
        }, this.timeoutMs);

        // Wait for images with a short bounded sub-timeout, then settle and print
        const executeAfterReadiness = () => {
          this.waitForImages(printWin!, Math.min(1500, this.timeoutMs / 2)).finally(() => {
            setTimeout(() => {
              clearGlobalTimer();
              try {
                if (!printWin || printWin.closed) {
                  reject(new ExportError(ExportErrorCode.PRINT_FAILED, 'Print window was closed before printing.'));
                  return;
                }
                printWin.focus();
                printWin.print();
                succeed();
              } catch (err) {
                failWith(new ExportError(ExportErrorCode.PRINT_FAILED, String(err)));
              }
            }, this.settleMs);
          });
        };

        // Wait for document readiness
        if (printWin.document.readyState === 'complete') {
          executeAfterReadiness();
        } else {
          printWin.onload = () => executeAfterReadiness();
        }
      } catch (err) {
        clearGlobalTimer();
        closeWindow();
        if (err instanceof ExportError) {
          reject(err);
        } else {
          reject(new ExportError(ExportErrorCode.PRINT_FAILED, String(err)));
        }
      }
    });
  }

  /**
   * Waits for all <img> elements in the print document to load or error out.
   * Never waits beyond the given timeoutMs. A broken image is treated as ready.
   */
  private waitForImages(printWin: Window, timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve) => {
      let images: HTMLImageElement[] = [];
      try {
        images = Array.from(printWin.document.querySelectorAll('img'));
      } catch {
        return resolve();
      }

      const pending = images.filter((img) => !img.complete);
      if (pending.length === 0) return resolve();

      let settled = 0;
      const timer = setTimeout(resolve, timeoutMs);

      const onSettled = () => {
        settled++;
        if (settled >= pending.length) {
          clearTimeout(timer);
          resolve();
        }
      };

      pending.forEach((img) => {
        img.addEventListener('load', onSettled, { once: true });
        img.addEventListener('error', onSettled, { once: true });
      });
    });
  }
}
