<script lang="ts">
  import { onMount } from "svelte";
  import type { Workbook, Sheet } from "../../src/index.js";
  import { createWorkbook, writeVmm, workbookToMarkdown, markdownToWorkbook, findTopic, addSheet, readVmm } from "../../src/index.js";
  import { readVmmFromFile, readVmmFromUrl } from "./lib/loadVmm.js";
  import {
    isTauri, basename, nativeSaveDialog, nativeOpenDialog, nativeWrite, nativeRead,
    getOpenedFile, onOpenFile, hasFilePicker, browserSavePicker, browserDownload,
    checkForUpdate, openExternal, type UpdateInfo,
  } from "./lib/platform.js";
  import MindMapView from "./lib/MindMapView.svelte";
  import Inspector from "./lib/Inspector.svelte";
  import Icon from "./lib/Icon.svelte";
  import logoUrl from "../../app-icon.png";

  let exportOpen = $state(false);
  const SAMPLES = [
    { id: "rich", title: "Project Plan", note: "styles · relationships · sheets" },
    { id: "minimal", title: "Hello VynMindMap", note: "a tiny starter map" },
    { id: "structures", title: "Structures", note: "every layout type" },
  ];

  let workbook = $state<Workbook | null>(null);
  let resources = $state<Record<string, Uint8Array>>({});
  let fileName = $state<string>("");
  let currentPath = $state<string | null>(null); // native path of the open file, if any
  let activeSheet = $state(0);
  let dirty = $state(false);
  let error = $state<string>("");
  let warning = $state<string>("");
  let view = $state<MindMapView | null>(null);
  let viewportEl = $state<HTMLDivElement | null>(null);

  // --- undo / redo history (snapshots of the whole workbook) ---------------
  let history = $state<Workbook[]>([]);
  let histIndex = $state(-1);
  let lastPush = 0;
  const canUndo = $derived(histIndex > 0);
  const canRedo = $derived(histIndex >= 0 && histIndex < history.length - 1);

  function resetHistory() {
    history = workbook ? [structuredClone($state.snapshot(workbook) as Workbook)] : [];
    histIndex = workbook ? 0 : -1;
    lastPush = 0;
  }

  function focus(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  function markDirty() {
    dirty = true;
    if (!workbook) return;
    const snap = structuredClone($state.snapshot(workbook) as Workbook);
    const now = Date.now();
    if (now - lastPush < 400 && histIndex >= 0) {
      history[histIndex] = snap; // coalesce a burst of rapid edits into one step
    } else {
      history = history.slice(0, histIndex + 1);
      history.push(snap);
      if (history.length > 100) history.shift();
      histIndex = history.length - 1;
    }
    lastPush = now;
  }

  function restore(index: number) {
    const snap = history[index];
    if (!snap) return;
    workbook = structuredClone($state.snapshot(snap) as Workbook);
    histIndex = index;
    activeSheet = Math.min(activeSheet, workbook.sheets.length - 1);
    selectedId = null;
    dirty = true;
  }
  function undo() { if (canUndo) restore(histIndex - 1); }
  function redo() { if (canRedo) restore(histIndex + 1); }

  let selectedId = $state<string | null>(null);
  let update = $state<UpdateInfo | null>(null);

  const sheet = $derived<Sheet | null>(
    workbook && workbook.sheets[activeSheet] ? workbook.sheets[activeSheet]! : null,
  );

  const selectedTopic = $derived(sheet && selectedId ? findTopic(sheet, selectedId) ?? null : null);

  let fileInput: HTMLInputElement;

  async function onPick(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    await load(() => readVmmFromFile(f), f.name);
  }

  async function loadExample(name: string) {
    await load(() => readVmmFromUrl(`/${name}`), name);
  }

  async function load(fn: () => Promise<{ workbook: Workbook; resources: Record<string, Uint8Array>; newerMinor: boolean; migrated: boolean }>, name: string, path: string | null = null) {
    error = ""; warning = "";
    try {
      const res = await fn();
      workbook = res.workbook;
      resources = res.resources ?? {};
      fileName = name;
      currentPath = path;
      activeSheet = 0;
      selectedId = null;
      dirty = false;
      resetHistory();
      if (res.newerMinor) warning = "Opened a file from a newer minor format version (loaded leniently).";
      if (res.migrated) warning = "File was migrated from an older format version.";
      queueFit();
    } catch (err) {
      workbook = null;
      error = (err as Error).message;
    }
  }

  function newMap() {
    error = ""; warning = "";
    workbook = createWorkbook("Central Topic");
    resources = {};
    fileName = "untitled.vmm";
    currentPath = null;
    activeSheet = 0;
    selectedId = null;
    dirty = false;
    resetHistory();
    queueFit();
  }

  // Read and load a .vmm at a native path (open dialog, launch arg, or file event).
  async function openNativePath(path: string) {
    error = ""; warning = "";
    try {
      const bytes = await nativeRead(path);
      await load(async () => readVmm(bytes), basename(path), path);
    } catch (e) {
      error = `Open failed: ${(e as Error).message}`;
    }
  }

  // Open via the native dialog (Tauri) or the file input (browser).
  async function openFile() {
    if (isTauri()) {
      let path: string | null;
      try { path = await nativeOpenDialog(); } catch (e) { error = (e as Error).message; return; }
      if (path) await openNativePath(path);
    } else {
      fileInput.click();
    }
  }

  // --- sheet management -----------------------------------------------------
  function addNewSheet() {
    if (!workbook) return;
    addSheet(workbook, `Sheet ${workbook.sheets.length + 1}`);
    activeSheet = workbook.sheets.length - 1;
    selectedId = null;
    markDirty();
    queueFit();
  }
  function deleteSheet(i: number) {
    if (!workbook || workbook.sheets.length <= 1) return;
    workbook.sheets.splice(i, 1);
    activeSheet = Math.max(0, Math.min(activeSheet, workbook.sheets.length - 1));
    selectedId = null;
    markDirty();
    queueFit();
  }
  let editingTab = $state<number | null>(null);
  function renameSheet(i: number, title: string) {
    if (workbook && title.trim()) { workbook.sheets[i]!.title = title.trim(); markDirty(); }
    editingTab = null;
  }

  function defaultSaveName(): string {
    return fileName && fileName.endsWith(".vmm") ? fileName : "Untitled.vmm";
  }

  /**
   * Save the workbook. If it has no known path yet (new map, or one opened from
   * an example / Markdown), prompt for a location and name first. `forceDialog`
   * is the "Save As" behaviour.
   */
  async function save(forceDialog = false) {
    if (!workbook) return;
    error = "";
    // $state.snapshot unwraps Svelte's reactive proxy to a plain object.
    const bytes = writeVmm($state.snapshot(workbook) as Workbook, $state.snapshot(resources) as Record<string, Uint8Array>);
    const name = defaultSaveName();

    if (isTauri()) {
      let path = forceDialog ? null : currentPath;
      if (!path) {
        try { path = await nativeSaveDialog(name); } catch (e) { error = (e as Error).message; return; }
        if (!path) return; // user cancelled
      }
      try {
        await nativeWrite(path, bytes);
      } catch (e) {
        error = `Save failed: ${(e as Error).message}`;
        return;
      }
      currentPath = path;
      fileName = basename(path);
      dirty = false;
    } else if (hasFilePicker()) {
      const saved = await browserSavePicker(name, bytes);
      if (!saved) return;
      fileName = name;
      dirty = false;
    } else {
      browserDownload(name, bytes);
      dirty = false;
    }
  }
  const saveAs = () => save(true);

  function download(name: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function exportMarkdown() {
    if (!workbook) return;
    const md = workbookToMarkdown($state.snapshot(workbook) as Workbook);
    download((fileName || "untitled").replace(/\.vmm$/, "") + ".md", md, "text/markdown");
  }

  let mdInput: HTMLInputElement;
  async function onPickMarkdown(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    error = ""; warning = "";
    try {
      workbook = markdownToWorkbook(await f.text());
      resources = {};
      fileName = f.name.replace(/\.md$/i, ".vmm");
      currentPath = null;
      activeSheet = 0;
      selectedId = null;
      dirty = true;
      resetHistory();
      queueFit();
    } catch (err) {
      error = (err as Error).message;
    }
  }

  function queueFit() {
    // Wait for the view + layout to mount, then fit to the viewport.
    requestAnimationFrame(() => {
      if (view && viewportEl) view.fit(viewportEl.clientWidth, viewportEl.clientHeight);
    });
  }

  $effect(() => {
    activeSheet; // re-fit when switching sheets
    queueFit();
  });

  onMount(async () => {
    // Native: if launched by opening a .vmm (file association), load it; and
    // listen for subsequent "open with" launches (single-instance).
    if (isTauri()) {
      onOpenFile((path) => openNativePath(path));
      try {
        const path = await getOpenedFile();
        if (path) { await openNativePath(path); return; }
      } catch (e) {
        error = (e as Error).message;
      }
      return;
    }
    // Deep-link / test hook: /?example=rich auto-loads a bundled example.
    const name = new URLSearchParams(location.search).get("example");
    if (name) loadExample(name.endsWith(".vmm") ? name : `${name}.vmm`);
  });

  // Check GitHub for a newer release (native app only).
  onMount(() => {
    checkForUpdate().then((u) => { if (u) update = u; });
  });

  $effect(() => {
    function warnUnsaved(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", warnUnsaved);
    return () => window.removeEventListener("beforeunload", warnUnsaved);
  });

  // Close the Export menu when clicking elsewhere.
  $effect(() => {
    if (!exportOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(".menu-wrap")) exportOpen = false;
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  });

  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return; // let fields do native undo
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
      else if (k === "s") { e.preventDefault(); if (e.shiftKey) saveAs(); else save(); }
      else if (k === "n") { e.preventDefault(); newMap(); }
      else if (k === "o") { e.preventDefault(); openFile(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<div class="app">
  <header>
    <div class="brand"><img class="brand-logo" src={logoUrl} alt="" /><span>VynMindMap</span></div>

    <div class="group">
      <button class="ic" onclick={newMap} title="New map (Ctrl+N)" aria-label="New"><Icon name="file-plus" /></button>
      <button class="ic" onclick={openFile} title="Open…  (Ctrl+O)" aria-label="Open"><Icon name="folder-open" /></button>
      <button class="ic" onclick={() => save()} disabled={!workbook} title="Save (Ctrl+S)" aria-label="Save"><Icon name="save" /></button>
      <button class="ic" onclick={saveAs} disabled={!workbook} title="Save As… (Ctrl+Shift+S)" aria-label="Save As"><Icon name="save-as" /></button>
    </div>

    <div class="divider"></div>
    <div class="group">
      <button class="ic" onclick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo"><Icon name="undo" /></button>
      <button class="ic" onclick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" aria-label="Redo"><Icon name="redo" /></button>
    </div>

    <div class="divider"></div>
    <div class="group">
      <button class="ic" onclick={() => mdInput.click()} title="Import a Markdown outline" aria-label="Import Markdown"><Icon name="upload" /></button>
      <div class="menu-wrap">
        <button class="ic chev" disabled={!workbook} onclick={() => (exportOpen = !exportOpen)} title="Export" aria-label="Export">
          <Icon name="download" /><Icon name="chevron-down" size={14} />
        </button>
        {#if exportOpen}
          <div class="menu" role="menu">
            <button role="menuitem" onclick={() => { exportMarkdown(); exportOpen = false; }}><Icon name="markdown" size={16} /> Markdown (.md)</button>
            <button role="menuitem" onclick={() => { view?.exportPng(); exportOpen = false; }}><Icon name="image" size={16} /> Image (.png)</button>
            <button role="menuitem" onclick={() => { view?.exportPdf(); exportOpen = false; }}><Icon name="file-text" size={16} /> Document (.pdf)</button>
          </div>
        {/if}
      </div>
    </div>

    <input bind:this={fileInput} type="file" accept=".vmm" onchange={onPick} hidden />
    <input bind:this={mdInput} type="file" accept=".md,.markdown,text/markdown" onchange={onPickMarkdown} hidden />

    {#if fileName}<span class="file">{#if dirty}<span class="dot" title="Unsaved changes"></span>{/if}{fileName}</span>{/if}
  </header>

  {#if update}
    <div class="banner update">
      <span><strong>Update available</strong> — VynMindMap v{update.version} is out.</span>
      <span class="update-actions">
        <button class="update-btn" onclick={() => update && openExternal(update.url)}>Download</button>
        <button class="update-dismiss" onclick={() => (update = null)} aria-label="Dismiss">✕</button>
      </span>
    </div>
  {/if}
  {#if warning}<div class="banner warn">{warning}</div>{/if}
  {#if error}<div class="banner err">⚠ {error}</div>{/if}

  {#if workbook}
    <nav class="tabs">
      {#each workbook.sheets as s, i (s.id)}
        <div class="tab" class:active={i === activeSheet}>
          {#if editingTab === i}
            <input
              class="tab-edit"
              value={s.title}
              onblur={(e) => renameSheet(i, e.currentTarget.value)}
              onkeydown={(e) => { if (e.key === "Enter") renameSheet(i, e.currentTarget.value); if (e.key === "Escape") editingTab = null; }}
              use:focus
            />
          {:else}
            <button class="tab-label" onclick={() => (activeSheet = i)} ondblclick={() => (editingTab = i)}>
              {s.title}
            </button>
            {#if workbook.sheets.length > 1}
              <button class="tab-x" title="Delete sheet" onclick={() => deleteSheet(i)}>×</button>
            {/if}
          {/if}
        </div>
      {/each}
      <button class="tab-add" title="Add sheet" onclick={addNewSheet}>+</button>
    </nav>
    <div class="workspace">
      <div class="viewport" bind:this={viewportEl}>
        {#if sheet}
          <MindMapView bind:this={view} {sheet} {resources} {markDirty} bind:selectedId />
        {/if}
      </div>
      {#if sheet}
        <Inspector {sheet} topic={selectedTopic} {markDirty} />
      {/if}
    </div>
  {:else}
    <div class="welcome">
      <div class="hero">
        <div class="logo"><img src={logoUrl} alt="VynMindMap" /></div>
        <h1>VynMindMap</h1>
        <p class="tagline">Visual mind mapping, stored as plain <code>.vmm</code> files.</p>
        <div class="cta">
          <button class="primary" onclick={newMap}><Icon name="file-plus" size={18} /> New mind map</button>
          <button class="outlined" onclick={openFile}><Icon name="folder-open" size={18} /> Open file…</button>
        </div>
      </div>
      <div class="samples">
        <div class="samples-label">Sample maps</div>
        <div class="sample-grid">
          {#each SAMPLES as s (s.id)}
            <button class="sample" onclick={() => loadExample(`${s.id}.vmm`)}>
              <span class="sample-icon"><Icon name="sitemap" size={20} /></span>
              <span class="sample-text">
                <strong>{s.title}</strong>
                <small>{s.note}</small>
              </span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .app { display: flex; flex-direction: column; height: 100%; }

  /* Material top app bar with grouped icon buttons. */
  header {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 12px;
    background: var(--md-primary);
    color: var(--md-on-primary);
    box-shadow: var(--elev-2);
    z-index: 5;
  }
  .brand { display: flex; align-items: center; gap: 9px; font-size: 16px; font-weight: 700; letter-spacing: 0.3px; color: #fff; margin-right: 10px; padding-left: 2px; }
  .brand-logo { width: 30px; height: 30px; border-radius: 8px; background: #fff; padding: 3px; box-sizing: border-box; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18); }
  .group { display: flex; align-items: center; gap: 2px; }
  .divider { width: 1px; height: 22px; background: rgba(255, 255, 255, 0.26); margin: 0 8px; }
  header button {
    display: inline-flex; align-items: center; justify-content: center; gap: 1px;
    width: 36px; height: 34px; padding: 0;
    border: none; border-radius: 9px;
    background: transparent; color: rgba(255, 255, 255, 0.92);
  }
  header button.chev { width: auto; padding: 0 7px; }
  header button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.18); }
  header button:active:not(:disabled) { background: rgba(255, 255, 255, 0.30); }
  header button:disabled { color: rgba(255, 255, 255, 0.4); opacity: 1; }
  .menu-wrap { position: relative; display: inline-flex; }
  .menu {
    position: absolute; top: calc(100% + 6px); right: 0; min-width: 196px;
    background: var(--panel); color: var(--text);
    border: 1px solid var(--border); border-radius: 10px;
    box-shadow: var(--elev-3); padding: 6px; z-index: 20;
  }
  .menu button {
    display: flex; align-items: center; gap: 10px; width: 100%; height: 36px;
    justify-content: flex-start; padding: 0 10px; border-radius: 7px;
    color: var(--text); background: transparent; font-weight: 500; font-size: 13px;
  }
  .menu button:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }
  .file { margin-left: auto; display: flex; align-items: center; gap: 7px; color: rgba(255, 255, 255, 0.94); font-size: 13px; font-weight: 500; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #ffd166; box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25); }

  .banner { padding: 8px 14px; font-size: 13px; }
  .banner.warn { background: #fff7e6; color: #8a5a00; border-bottom: 1px solid #f0e0b8; }
  .banner.err { background: #fdecea; color: #a02018; border-bottom: 1px solid #f3c6c0; }
  .banner.update {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    background: color-mix(in srgb, var(--accent) 12%, #fff); color: var(--text);
    border-bottom: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
  }
  .update-actions { display: flex; align-items: center; gap: 6px; }
  .update-btn { background: var(--md-primary); color: #fff; border-color: transparent; border-radius: 18px; padding: 5px 16px; font-size: 12px; }
  .update-btn:hover:not(:disabled) { background: var(--md-primary-hover); }
  .update-dismiss { border: none; background: transparent; color: var(--muted); padding: 4px 6px; border-radius: 6px; }
  .update-dismiss:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }

  /* Material tabs: surface bar with a primary active indicator. */
  .tabs { display: flex; align-items: stretch; gap: 2px; padding: 0 10px; background: var(--panel); box-shadow: var(--elev-1); z-index: 4; }
  .tab { display: flex; align-items: center; position: relative; }
  .tab.active { box-shadow: inset 0 -3px 0 var(--accent); }
  .tab-label { border: none; border-radius: 0; padding: 11px 10px 10px 14px; font-size: 13px; background: transparent; color: var(--muted); font-weight: 500; }
  .tab.active .tab-label { color: var(--accent); font-weight: 600; }
  .tab-label:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 8%, transparent); border-color: transparent; }
  .tab-x { border: none; background: none; color: var(--muted); padding: 0 8px; font-size: 15px; line-height: 1; }
  .tab-x:hover:not(:disabled) { color: #c0392b; background: transparent; }
  .tab-add { border: none; background: none; color: var(--muted); padding: 9px 12px; font-size: 17px; }
  .tab-add:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 8%, transparent); border-color: transparent; }
  .tab-edit { width: 120px; padding: 5px 9px; border: 1px solid var(--accent); border-radius: 6px; font: inherit; margin: 4px 2px; }
  .workspace { flex: 1; display: flex; min-height: 0; }
  .viewport { position: relative; flex: 1; min-height: 0; min-width: 0; }
  code { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); padding: 1px 6px; border-radius: 5px; font-size: 0.88em; }

  /* Welcome / empty state */
  .welcome {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; gap: 30px; padding: 24px; text-align: center; overflow-y: auto;
    background:
      radial-gradient(1100px 480px at 50% -12%, color-mix(in srgb, var(--accent) 12%, transparent), transparent),
      var(--bg);
  }
  .hero { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .logo {
    width: 88px; height: 88px; border-radius: 22px; display: grid; place-items: center;
    background: #fff; box-shadow: var(--elev-2); margin-bottom: 8px; padding: 12px;
    border: 1px solid var(--border);
  }
  .logo img { width: 100%; height: 100%; object-fit: contain; }
  .welcome h1 { margin: 0; font-size: 30px; font-weight: 700; letter-spacing: 0.3px; }
  .tagline { margin: 0; color: var(--muted); font-size: 15px; }
  .cta { display: flex; gap: 12px; margin-top: 16px; }
  .cta button { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 22px; border-radius: 22px; font-size: 14px; }
  .cta .primary { background: var(--md-primary); color: #fff; border-color: transparent; box-shadow: var(--elev-1); }
  .cta .primary:hover:not(:disabled) { background: var(--md-primary-hover); }
  .cta .outlined { background: var(--panel); color: var(--accent); border: 1px solid var(--border); }
  .samples { width: 100%; max-width: 740px; }
  .samples-label { text-transform: uppercase; letter-spacing: 0.6px; font-size: 11px; color: var(--muted); margin-bottom: 12px; font-weight: 700; }
  .sample-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .sample {
    display: flex; align-items: center; gap: 12px; text-align: left;
    padding: 14px; border-radius: 14px; border: 1px solid var(--border);
    background: var(--panel); box-shadow: var(--elev-1); color: var(--text);
    transition: box-shadow 0.15s, border-color 0.15s, transform 0.12s;
  }
  .sample:hover { box-shadow: var(--elev-2); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); transform: translateY(-1px); }
  .sample-icon { width: 42px; height: 42px; border-radius: 11px; display: grid; place-items: center; color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); flex: none; }
  .sample-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .sample-text strong { font-size: 14px; }
  .sample-text small { color: var(--muted); font-size: 12px; }
</style>
