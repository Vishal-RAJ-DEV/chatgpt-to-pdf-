/**
 * Local Print Surface Service — Phase 6.
 *
 * Encapsulates browser print surface creation (window.open / document write)
 * and window.print() execution behind an isolated service layer.
 */

import { ExportError, ExportErrorCode } from './ExportErrors';

export interface PrintWindowOptions {
  timeoutMs?: number;
}

export class PrintService {
  private timeoutMs: number;

  constructor(options?: PrintWindowOptions) {
    this.timeoutMs = options?.timeoutMs || 5000;
  }

  /**
   * Opens standalone HTML in a temporary print surface and triggers native browser print dialog.
   */
  public async print(html: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      throw new ExportError(ExportErrorCode.PRINT_FAILED, 'Window environment unavailable for printing.');
    }

    return new Promise<boolean>((resolve, reject) => {
      let printWin: Window | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
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

        // Bounded timeout in case print dialog or load hangs
        timer = setTimeout(() => {
          cleanup();
          reject(new ExportError(ExportErrorCode.PRINT_TIMEOUT));
        }, this.timeoutMs);

        // Execute print once document is ready
        const triggerPrint = () => {
          cleanup();
          try {
            if (printWin) {
              printWin.focus();
              printWin.print();
              // Note: printWin.close() can be called after print returns or on focus change
              resolve(true);
            } else {
              reject(new ExportError(ExportErrorCode.PRINT_FAILED));
            }
          } catch (err) {
            reject(new ExportError(ExportErrorCode.PRINT_FAILED, String(err)));
          }
        };

        if (printWin.document.readyState === 'complete') {
          // Microtask delay to ensure CSS render tree layout settles
          setTimeout(triggerPrint, 100);
        } else {
          printWin.onload = () => {
            setTimeout(triggerPrint, 100);
          };
        }
      } catch (err) {
        cleanup();
        if (err instanceof ExportError) {
          reject(err);
        } else {
          reject(new ExportError(ExportErrorCode.PRINT_FAILED, String(err)));
        }
      }
    });
  }
}
