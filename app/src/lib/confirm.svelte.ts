/**
 * In-app confirmation dialogs — a promise-based replacement for the browser's
 * native `confirm()`. Call `confirmDialog({...})` and await the boolean; a
 * single <ConfirmHost /> mounted in App renders the actual modal.
 */

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). */
  danger?: boolean;
}

interface Pending {
  opts: ConfirmOptions;
  resolve: (ok: boolean) => void;
}

class ConfirmStore {
  current = $state<Pending | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    // If one is already open, resolve it as cancelled before replacing it.
    this.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      this.current = { opts, resolve };
    });
  }

  answer(ok: boolean) {
    const cur = this.current;
    this.current = null;
    cur?.resolve(ok);
  }
}

export const confirmStore = new ConfirmStore();

/** Show a confirm dialog; resolves true if the user confirms. */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return confirmStore.ask(opts);
}
