<script lang="ts">
  import type { Sheet, Topic } from "../../../src/index.js";
  import { toggleCollapse } from "../../../src/index.js";

  let {
    sheet,
    selectedId = $bindable(null),
    markDirty,
    reveal,
  }: {
    sheet: Sheet;
    selectedId?: string | null;
    markDirty: () => void;
    /** Center the canvas on a topic (wired to the view's centerOn). */
    reveal: (id: string) => void;
  } = $props();

  let editingId = $state<string | null>(null);
  let editValue = $state("");
  let editEl = $state<HTMLInputElement | null>(null);

  function select(t: Topic) {
    selectedId = t.id;
    reveal(t.id);
  }

  function chevron(e: Event, t: Topic) {
    e.stopPropagation();
    toggleCollapse(t);
    markDirty();
  }

  function beginEdit(t: Topic) {
    editingId = t.id;
    editValue = t.title;
    requestAnimationFrame(() => { editEl?.focus(); editEl?.select(); });
  }

  function commitEdit(t: Topic) {
    if (editingId === t.id) {
      const v = editValue.trim();
      if (v && v !== t.title) { t.title = v; markDirty(); }
    }
    editingId = null;
  }

  function onEditKey(e: KeyboardEvent, t: Topic) {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(t); }
    else if (e.key === "Escape") { e.preventDefault(); editingId = null; }
  }
</script>

{#snippet row(t: Topic, depth: number)}
  <div
    class="row"
    class:sel={t.id === selectedId}
    style={`padding-left:${8 + depth * 14}px`}
    role="button"
    tabindex={0}
    onclick={() => select(t)}
    ondblclick={() => beginEdit(t)}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(t); }
      else if (e.key === "F2") { e.preventDefault(); beginEdit(t); }
    }}
  >
    {#if t.children?.length}
      <button class="chev" class:closed={t.collapsed} aria-label={t.collapsed ? "Expand" : "Collapse"}
        onclick={(e) => chevron(e, t)}>▾</button>
    {:else}
      <span class="dot">•</span>
    {/if}
    {#if editingId === t.id}
      <input
        bind:this={editEl}
        bind:value={editValue}
        onkeydown={(e) => onEditKey(e, t)}
        onblur={() => commitEdit(t)}
        onclick={(e) => e.stopPropagation()}
      />
    {:else}
      <span class="title">{t.title || " "}</span>
    {/if}
  </div>
  {#if !t.collapsed}
    {#each t.children ?? [] as c (c.id)}
      {@render row(c, depth + 1)}
    {/each}
  {/if}
{/snippet}

<aside class="outline">
  <h3>Outline</h3>
  {@render row(sheet.rootTopic, 0)}
  {#if sheet.floatingTopics?.length}
    <h4>Floating</h4>
    {#each sheet.floatingTopics as f (f.id)}
      {@render row(f, 0)}
    {/each}
  {/if}
</aside>

<style>
  .outline {
    width: 232px; flex: none; height: 100%; overflow-y: auto;
    background: var(--panel); border-right: 1px solid var(--border);
    box-shadow: var(--elev-1);
    padding: 12px 8px; font-size: 13px;
  }
  h3 {
    margin: 0 6px 10px; font-size: 12px; text-transform: uppercase;
    letter-spacing: 0.6px; color: var(--accent); font-weight: 700;
  }
  h4 {
    margin: 14px 6px 6px; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.4px; color: var(--muted);
  }
  .row {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 8px 4px 8px; border-radius: 7px; cursor: pointer;
    color: var(--text); user-select: none;
  }
  .row:hover { background: var(--surface-2); }
  .row.sel { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .title {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    flex: 1; min-width: 0;
  }
  .chev {
    flex: none; width: 18px; height: 18px; padding: 0;
    border: none; background: none; color: var(--muted);
    font-size: 11px; line-height: 1; border-radius: 4px;
    transition: transform 0.12s ease;
  }
  .chev.closed { transform: rotate(-90deg); }
  .chev:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
  .dot { flex: none; width: 18px; text-align: center; color: var(--border); font-size: 10px; }
  input {
    flex: 1; min-width: 0; font: inherit; font-size: 12px;
    border: 1px solid var(--accent); border-radius: 5px; padding: 2px 6px;
    background: var(--panel); color: var(--text); outline: none;
  }
</style>
