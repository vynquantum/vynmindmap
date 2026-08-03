/** Small accessibility helpers shared by the dialogs. */

/** Everything a Tab press can land on, in document order. */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Where Tab (or Shift+Tab) should go next, wrapping at both ends. `current` is
 * -1 when focus sits outside the list, which lands on the first (or last) item.
 */
export function nextFocusIndex(count: number, current: number, backwards: boolean): number {
  if (count < 1) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return (((backwards ? current - 1 : current + 1) % count) + count) % count;
}

/**
 * Svelte action: keep Tab inside a modal, and hand focus back to whatever had
 * it when the modal closes. Without this, Tab walks into the map behind the
 * dialog, where a screen reader user has no way to tell they've left it.
 */
export function trapFocus(node: HTMLElement) {
  const returnTo = document.activeElement as HTMLElement | null;
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) return;
    e.preventDefault();
    const i = nextFocusIndex(
      items.length,
      items.indexOf(document.activeElement as HTMLElement),
      e.shiftKey
    );
    items[i]!.focus();
  };
  node.addEventListener('keydown', onKey);
  return {
    destroy() {
      node.removeEventListener('keydown', onKey);
      returnTo?.focus();
    }
  };
}
