<script lang="ts">
  /**
   * The keyboard cheat sheet (F1 or ?). Every key listed here is handled in
   * App.svelte or MindMapView.svelte — keep the two in step when adding keys.
   */
  import { trapFocus } from './a11y.js';

  let { onClose }: { onClose: () => void } = $props();

  let dialogEl = $state<HTMLDivElement | null>(null);
  $effect(() => {
    dialogEl?.focus();
  });

  const GROUPS: { title: string; keys: [string, string][] }[] = [
    {
      title: 'File',
      keys: [
        ['Ctrl+N', 'New map'],
        ['Ctrl+O', 'Open'],
        ['Ctrl+S', 'Save'],
        ['Ctrl+Shift+S', 'Save as'],
        ['Ctrl+W', 'Close map']
      ]
    },
    {
      title: 'Edit',
      keys: [
        ['Ctrl+Z', 'Undo'],
        ['Ctrl+Y', 'Redo'],
        ['Ctrl+C / X / V', 'Copy, cut, paste'],
        ['Ctrl+D', 'Duplicate'],
        ['Delete', 'Delete topic'],
        ['F2', 'Rename topic']
      ]
    },
    {
      title: 'Topics',
      keys: [
        ['Tab', 'Add subtopic'],
        ['Enter', 'Add topic after'],
        ['Shift+Enter', 'Add topic before'],
        ['Ctrl+Enter', 'Insert parent topic'],
        ['Ctrl+Shift+↑ / ↓', 'Move among siblings'],
        ['↑ ↓ ← →', 'Move the selection'],
        ['Ctrl+A', 'Select every topic'],
        ['Home', 'Go to the central topic']
      ]
    },
    {
      title: 'Folding',
      keys: [
        ['Space', 'Fold / unfold the topic'],
        ['+ / −', 'One level of the branch'],
        ['* / /', 'The whole branch'],
        ['Ctrl+* / Ctrl+/', 'Unfold all / fold all'],
        ['Ctrl+1 … Ctrl+9', 'Fold the map to that level']
      ]
    },
    {
      title: 'Connect & group',
      keys: [
        ['Ctrl+L', 'Relationship from the selection'],
        ['Ctrl+Shift+B', 'Boundary around the selection'],
        ['Ctrl+]', 'Summary of the selection']
      ]
    },
    {
      title: 'Find & view',
      keys: [
        ['Ctrl+F', 'Find in titles, notes, labels'],
        ['F3 / Shift+F3', 'Next / previous match'],
        ['Ctrl+= / Ctrl+−', 'Zoom in / out'],
        ['Ctrl+0', 'Reset zoom'],
        ['F8', 'Zen mode'],
        ['PageDown / PageUp', 'Present: next / previous topic'],
        ['F1 or ?', 'This list']
      ]
    }
  ];
</script>

<div class="backdrop">
  <button class="scrim" aria-label="Close" onclick={onClose}></button>
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts"
    tabindex={-1}
    bind:this={dialogEl}
    use:trapFocus
  >
    <header>
      <h2>Keyboard shortcuts</h2>
      <button class="close" aria-label="Close" onclick={onClose}>✕</button>
    </header>
    <div class="groups">
      {#each GROUPS as group (group.title)}
        <section>
          <h3>{group.title}</h3>
          {#each group.keys as [key, what] (key)}
            <div class="row"><kbd>{key}</kbd><span>{what}</span></div>
          {/each}
        </section>
      {/each}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
  }
  .scrim {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    cursor: default;
    background: rgba(15, 18, 28, 0.5);
  }
  .scrim:hover:not(:disabled) {
    background: rgba(15, 18, 28, 0.5);
  }
  .dialog {
    position: relative;
    z-index: 1;
    width: min(760px, calc(100vw - 40px));
    max-height: calc(100vh - 80px);
    overflow: auto;
    background: var(--panel);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--elev-3);
    padding: 18px 22px 22px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
  }
  .close {
    padding: 4px 10px;
  }
  .groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 6px 26px;
  }
  h3 {
    margin: 10px 0 6px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    padding: 2px 0;
  }
  .row span {
    color: var(--muted);
    text-align: right;
  }
  kbd {
    font: 600 11px/1.6 var(--mono, ui-monospace, monospace);
    background: var(--chip, rgba(127, 127, 127, 0.14));
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px 6px;
    white-space: nowrap;
  }
</style>
