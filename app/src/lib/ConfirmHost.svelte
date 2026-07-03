<script lang="ts">
  import { confirmStore } from "./confirm.svelte.js";

  const cur = $derived(confirmStore.current);

  let confirmBtn = $state<HTMLButtonElement | null>(null);
  // Focus the confirm button when a dialog opens so Enter works immediately.
  $effect(() => {
    if (cur) requestAnimationFrame(() => confirmBtn?.focus());
  });

  function onKey(e: KeyboardEvent) {
    if (!cur) return;
    if (e.key === "Escape") { e.preventDefault(); confirmStore.answer(false); }
    else if (e.key === "Enter") { e.preventDefault(); confirmStore.answer(true); }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if cur}
  <div class="backdrop">
    <!-- A real button behind the dialog handles click-outside-to-dismiss,
         so it's keyboard-focusable; Escape is handled globally above. -->
    <button class="scrim" aria-label="Dismiss" onclick={() => confirmStore.answer(false)}></button>
    <div class="dialog" role="alertdialog" aria-modal="true" tabindex={-1}
      aria-label={cur.opts.title ?? "Confirm"}>
      {#if cur.opts.title}<h2>{cur.opts.title}</h2>{/if}
      <p>{cur.opts.message}</p>
      <div class="actions">
        <button class="cancel" onclick={() => confirmStore.answer(false)}>
          {cur.opts.cancelLabel ?? "Cancel"}
        </button>
        <button class="confirm" class:danger={cur.opts.danger} bind:this={confirmBtn}
          onclick={() => confirmStore.answer(true)}>
          {cur.opts.confirmLabel ?? "OK"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 100;
    display: grid; place-items: center;
    animation: fade 0.12s ease;
  }
  .scrim {
    position: absolute; inset: 0; z-index: 0;
    width: 100%; height: 100%; padding: 0; margin: 0;
    border: none; border-radius: 0; cursor: default;
    background: rgba(15, 18, 28, 0.5);
  }
  .scrim:hover:not(:disabled) { background: rgba(15, 18, 28, 0.5); }
  .dialog {
    position: relative; z-index: 1;
    width: min(400px, calc(100vw - 40px));
    background: var(--panel); color: var(--text);
    border: 1px solid var(--border); border-radius: 14px;
    box-shadow: var(--elev-3); padding: 22px 22px 18px;
    animation: pop 0.14s ease;
  }
  h2 { margin: 0 0 8px; font-size: 16px; font-weight: 700; }
  p { margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: var(--muted); }
  .actions { display: flex; justify-content: flex-end; gap: 10px; }
  .actions button { padding: 8px 18px; }
  .confirm {
    background: var(--accent); color: var(--md-on-primary); border-color: var(--accent);
  }
  .confirm:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 85%, #000); border-color: transparent;
  }
  .confirm.danger { background: #d0392b; border-color: #d0392b; }
  .confirm.danger:hover:not(:disabled) { background: #b12d21; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } }
</style>
