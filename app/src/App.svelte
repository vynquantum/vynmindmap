<script lang="ts">
  import { onMount } from "svelte";
  import type { Workbook, Sheet } from "../../src/index.js";
  import { createWorkbook, writeVmm, workbookToMarkdown, markdownToWorkbook, findTopic, addSheet, readVmm } from "../../src/index.js";
  import { readVmmFromFile, readVmmFromUrl } from "./lib/loadVmm.js";
  import {
    isTauri, basename, nativeSaveDialog, nativeOpenDialog, nativeWrite, nativeRead,
    nativeModifiedMs, getOpenedFile, onOpenFile, hasFilePicker, hasOpenPicker,
    browserSavePicker, browserOpenPicker, browserWriteHandle, browserDownload,
    checkForUpdate, checkForUpdateDetailed, openExternal, type UpdateInfo, type FsFileHandle,
  } from "./lib/platform.js";
  import {
    getRecents, addRecentPath, addRecentHandle, removeRecent, type RecentEntry,
  } from "./lib/recents.js";
  import MindMapView from "./lib/MindMapView.svelte";
  import Inspector from "./lib/Inspector.svelte";
  import OutlinePanel from "./lib/OutlinePanel.svelte";
  import ConfirmHost from "./lib/ConfirmHost.svelte";
  import { confirmDialog } from "./lib/confirm.svelte.js";
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
  // Browser (File System Access API) handle of the open file. Held so "Save"
  // writes back silently; only "Save As" re-prompts. Not reactive — no UI
  // reads it directly.
  let fileHandle: FsFileHandle | null = null;
  // Set when the browser refuses to write even a freshly picked file (the
  // site's "edit files" permission is blocked). While set, plain Save skips
  // the picker (which would create junk empty files) and downloads instead;
  // Save As still tries the picker so the user can test after unblocking.
  let directWriteBlocked = false;
  let activeSheet = $state(0);
  let dirty = $state(false);
  let error = $state<string>("");
  let warning = $state<string>("");
  let view = $state<MindMapView | null>(null);
  let viewportEl = $state<HTMLDivElement | null>(null);

  // --- undo / redo history (snapshots of the whole workbook) ---------------
  // Snapshots are JSON strings in a plain (non-reactive) array: strings are
  // compact, never get wrapped in reactivity proxies, and each entry GCs as
  // one unit — much lighter than 100 live deep-cloned object graphs.
  let history: string[] = [];
  let histIndex = $state(-1);
  let histLen = $state(0);
  let lastPush = 0;
  const canUndo = $derived(histIndex > 0);
  const canRedo = $derived(histIndex >= 0 && histIndex < histLen - 1);

  function snapshotStr(): string {
    return JSON.stringify($state.snapshot(workbook));
  }

  function resetHistory() {
    history = workbook ? [snapshotStr()] : [];
    histIndex = workbook ? 0 : -1;
    histLen = history.length;
    lastPush = 0;
  }

  function focus(node: HTMLInputElement) {
    node.focus();
    node.select();
  }

  function markDirty() {
    dirty = true;
    if (!workbook) return;
    const snap = snapshotStr();
    const now = Date.now();
    // Coalesce a burst of rapid edits into one step — but only at the head of
    // the history (never clobber redo states) and never over the baseline
    // snapshot at index 0, or undo-to-original would be lost.
    if (now - lastPush < 400 && histIndex === history.length - 1 && histIndex > 0) {
      history[histIndex] = snap;
    } else {
      history = history.slice(0, histIndex + 1);
      history.push(snap);
      if (history.length > 100) history.shift();
      histIndex = history.length - 1;
    }
    histLen = history.length;
    lastPush = now;
    scheduleAutosave();
  }

  function restore(index: number) {
    const snap = history[index];
    if (!snap) return;
    workbook = JSON.parse(snap) as Workbook;
    histIndex = index;
    activeSheet = Math.min(activeSheet, workbook.sheets.length - 1);
    selectedId = null;
    dirty = true;
    scheduleAutosave();
  }
  function undo() { if (canUndo) restore(histIndex - 1); }
  function redo() { if (canRedo) restore(histIndex + 1); }

  // --- preferences (persisted) ----------------------------------------------
  let theme = $state(localStorage.getItem("vynmm.theme") === "dark" ? "dark" : "light");
  $effect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vynmm.theme", theme);
  });

  let showOutline = $state(localStorage.getItem("vynmm.outline") === "1");
  $effect(() => { localStorage.setItem("vynmm.outline", showOutline ? "1" : "0"); });

  // Inspector (right sidebar) visibility — defaults to open on first run, then
  // remembers the user's choice so it stays out of the way once collapsed.
  let showInspector = $state(localStorage.getItem("vynmm.inspector") !== "0");
  $effect(() => { localStorage.setItem("vynmm.inspector", showInspector ? "1" : "0"); });

  let zenMode = $state(false);

  // --- autosave ---------------------------------------------------------------
  let autosave = $state(localStorage.getItem("vynmm.autosave") === "1");
  $effect(() => { localStorage.setItem("vynmm.autosave", autosave ? "1" : "0"); });
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  function scheduleAutosave() {
    if (!autosave) return;
    if (!currentPath && !fileHandle) return; // nowhere to save silently yet
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => { if (dirty && workbook) save(); }, 1200);
  }

  // --- external-change watch (Tauri) -----------------------------------------
  // The CLI and MCP server edit .vmm files directly; poll the open file's
  // mtime so those edits show up instead of being silently overwritten.
  let extChange = $state(false);
  let watchTimer: ReturnType<typeof setInterval> | undefined;
  let watchedPath: string | null = null;
  let lastMtime: number | null = null;

  function stopWatch() {
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = undefined;
    watchedPath = null;
    lastMtime = null;
    extChange = false;
  }

  function startWatch() {
    if (!isTauri() || !currentPath) { stopWatch(); return; }
    if (watchedPath === currentPath) return; // already watching this file
    stopWatch();
    const path = currentPath;
    watchedPath = path;
    nativeModifiedMs(path).then((m) => { if (watchedPath === path) lastMtime = m; });
    watchTimer = setInterval(async () => {
      if (watchedPath !== path) return;
      const m = await nativeModifiedMs(path);
      if (m === null || lastMtime === null || m <= lastMtime) return;
      lastMtime = m;
      if (dirty) { extChange = true; return; } // don't clobber unsaved edits
      await openNativePath(path); // clean → just pick up the external changes
    }, 2000);
  }

  // --- recent files -----------------------------------------------------------
  let recents = $state<RecentEntry[]>([]);
  async function refreshRecents() { recents = await getRecents(); }

  function relTime(when: number): string {
    const s = Math.max(0, (Date.now() - when) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  }

  async function openRecent(r: RecentEntry) {
    error = "";
    try {
      if (r.kind === "path" && r.path) {
        const bytes = await nativeRead(r.path);
        await load(async () => readVmm(bytes), basename(r.path!), r.path);
      } else if (r.kind === "handle" && r.handle) {
        const h = r.handle;
        // Ask for readwrite up front (we're inside the click gesture) so later
        // saves are silent; settle for read-only if the user declines.
        if (h.requestPermission && (await h.requestPermission({ mode: "readwrite" })) !== "granted") {
          if ((await h.requestPermission({ mode: "read" })) !== "granted") {
            throw new Error("permission denied");
          }
        }
        const file = await h.getFile();
        await load(() => readVmmFromFile(file), file.name, null, h);
      }
    } catch (e) {
      error = `Open failed: ${(e as Error).message}`;
      await removeRecent(r);
      refreshRecents();
    }
  }

  async function dropRecent(r: RecentEntry) {
    await removeRecent(r);
    refreshRecents();
  }

  let selectedId = $state<string | null>(null);
  let update = $state<UpdateInfo | null>(null);
  // Manual "check for updates" feedback (the startup check is silent).
  let checkingUpdate = $state(false);
  let updateMsg = $state("");

  async function checkUpdatesNow() {
    checkingUpdate = true;
    updateMsg = "";
    const r = await checkForUpdateDetailed();
    checkingUpdate = false;
    if (r.kind === "update") { update = { version: r.version, url: r.url }; }
    else if (r.kind === "current") { updateMsg = `You're on the latest version (v${r.version}).`; }
    else if (r.kind === "unsupported") { updateMsg = "You're running the web version, which is always up to date."; }
    else { updateMsg = `Couldn't check for updates: ${r.message}.`; }
  }

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

  async function load(fn: () => Promise<{ workbook: Workbook; resources: Record<string, Uint8Array>; newerMinor: boolean; migrated: boolean }>, name: string, path: string | null = null, handle: FsFileHandle | null = null) {
    error = ""; warning = "";
    try {
      const res = await fn();
      workbook = res.workbook;
      resources = res.resources ?? {};
      fileName = name;
      currentPath = path;
      fileHandle = handle;
      activeSheet = 0;
      selectedId = null;
      dirty = false;
      extChange = false;
      resetHistory();
      if (res.newerMinor) warning = "Opened a file from a newer minor format version (loaded leniently).";
      if (res.migrated) warning = "File was migrated from an older format version.";
      queueFit();
      // Remember where this map lives (recents + external-change watch).
      if (path) {
        addRecentPath(path, name).then(refreshRecents);
        startWatch();
      } else {
        stopWatch();
        if (handle) addRecentHandle(handle, name).then(refreshRecents);
      }
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
    fileHandle = null;
    activeSheet = 0;
    selectedId = null;
    dirty = false;
    stopWatch();
    resetHistory();
    queueFit();
  }

  // Close the current map and return to the welcome screen. Warns if there are
  // unsaved changes.
  async function closeMap() {
    if (!workbook) return;
    if (dirty && !(await confirmDialog({
      title: "Close this map?",
      message: "You have unsaved changes. Closing will discard them.",
      confirmLabel: "Close without saving",
      danger: true,
    }))) return;
    error = ""; warning = "";
    workbook = null;
    resources = {};
    fileName = "";
    currentPath = null;
    fileHandle = null;
    activeSheet = 0;
    selectedId = null;
    dirty = false;
    history = [];
    histIndex = -1;
    histLen = 0;
    clearTimeout(autosaveTimer);
    stopWatch();
    zenMode = false;
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

  // Open via the native dialog (Tauri), the File System Access picker
  // (Chromium — keeps a writable handle so Save writes straight back), or the
  // plain file input (fallback; read-only, first Save prompts for a location).
  async function openFile() {
    if (isTauri()) {
      let path: string | null;
      try { path = await nativeOpenDialog(); } catch (e) { error = (e as Error).message; return; }
      if (path) await openNativePath(path);
    } else if (hasOpenPicker()) {
      let handle: FsFileHandle | null;
      try { handle = await browserOpenPicker(); } catch (e) { error = (e as Error).message; return; }
      if (!handle) return; // user cancelled
      const file = await handle.getFile();
      await load(() => readVmmFromFile(file), file.name, null, handle);
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
  async function deleteSheet(i: number) {
    if (!workbook || workbook.sheets.length <= 1) return;
    const title = workbook.sheets[i]?.title || "this sheet";
    if (!(await confirmDialog({
      title: "Delete sheet?",
      message: `“${title}” and everything on it will be removed. You can undo with Ctrl+Z.`,
      confirmLabel: "Delete sheet",
      danger: true,
    }))) return;
    if (!workbook || workbook.sheets.length <= 1) return; // re-check after await
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

  /** Serialize the workbook (+ a best-effort thumbnail) to .vmm bytes. */
  async function buildVmmBytes(): Promise<Uint8Array> {
    const thumbnail = (await view?.thumbnail()) ?? undefined;
    // $state.snapshot unwraps Svelte's reactive proxy to a plain object.
    return writeVmm(
      $state.snapshot(workbook!) as Workbook,
      $state.snapshot(resources) as Record<string, Uint8Array>,
      { thumbnail },
    );
  }

  /**
   * Save the workbook. If it has no known path yet (new map, or one opened from
   * an example / Markdown), prompt for a location and name first. `forceDialog`
   * is the "Save As" behaviour.
   *
   * Ordering matters in the browser: pickers must run first, while the click's
   * transient user activation is still live — serializing the map (thumbnail
   * rendering can take a moment on big sheets) happens after the dialog.
   */
  async function save(forceDialog = false) {
    if (!workbook) return;
    error = "";

    if (isTauri()) {
      let path = forceDialog ? null : currentPath;
      if (!path) {
        try { path = await nativeSaveDialog(defaultSaveName()); } catch (e) { error = (e as Error).message; return; }
        if (!path) return; // user cancelled
      }
      const bytes = await buildVmmBytes();
      try {
        await nativeWrite(path, bytes);
      } catch (e) {
        error = `Save failed: ${(e as Error).message}`;
        return;
      }
      currentPath = path;
      fileName = basename(path);
      dirty = false;
      // Our own write bumped the mtime — sync the watcher so it doesn't fire.
      lastMtime = (await nativeModifiedMs(path)) ?? lastMtime;
      startWatch();
      addRecentPath(path, fileName).then(refreshRecents);
    } else if (hasFilePicker() && (!directWriteBlocked || forceDialog)) {
      let handle = forceDialog ? null : fileHandle;
      const remembered = handle !== null;
      if (!handle) {
        try { handle = await browserSavePicker(defaultSaveName()); } catch (e) { error = (e as Error).message; return; }
        if (!handle) return; // user cancelled
      }
      const bytes = await buildVmmBytes();
      try {
        await browserWriteHandle(handle, bytes);
      } catch (e) {
        if (remembered) {
          // The remembered handle went stale (file moved/deleted, permission
          // revoked) — re-prompt for a location, like a first save.
          try { handle = await browserSavePicker(defaultSaveName()); } catch (e2) { error = (e2 as Error).message; return; }
          if (!handle) return;
          try {
            await browserWriteHandle(handle, bytes);
          } catch {
            downloadFallback(handle.name, bytes);
            return;
          }
        } else {
          // The browser refused to write even a freshly picked file — its
          // "file editing" permission for this site is blocked. Don't dead-end:
          // deliver the map as a download and tell the user how to fix it.
          downloadFallback(handle.name, bytes);
          return;
        }
      }
      fileHandle = handle;
      fileName = handle.name; // the name the user actually chose in the dialog
      dirty = false;
      directWriteBlocked = false; // a write went through — permission is fine
      addRecentHandle(handle, handle.name).then(refreshRecents);
    } else {
      const bytes = await buildVmmBytes();
      browserDownload(defaultSaveName(), bytes);
      dirty = false;
    }
  }
  const saveAs = () => save(true);

  /** Browser denied direct file writes → save via the Downloads folder. */
  function downloadFallback(name: string, bytes: Uint8Array) {
    directWriteBlocked = true;
    browserDownload(name || defaultSaveName(), bytes);
    fileName = name || defaultSaveName();
    fileHandle = null; // writes don't work; don't pretend we can save silently
    dirty = false;
    warning = "The browser blocked writing to the file, so the map was saved to your "
      + "Downloads folder instead. To save in place, allow file editing for this site: "
      + "click the icon left of the address bar → Site settings → \"Edit files\" → Allow "
      + "(or Chrome Settings → Privacy → Site settings → Additional permissions → Edit files).";
  }

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
      fileHandle = null; // a fresh document — Save must ask where to put it
      activeSheet = 0;
      selectedId = null;
      dirty = true;
      stopWatch();
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
    refreshRecents();
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
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return; // let fields do native keys

      if (e.key === "F8") {
        e.preventDefault();
        zenMode = !zenMode;
        return;
      }

      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
      else if (k === "s") { e.preventDefault(); if (e.shiftKey) saveAs(); else save(); }
      else if (k === "n") { e.preventDefault(); newMap(); }
      else if (k === "o") { e.preventDefault(); openFile(); }
      else if (k === "w") { e.preventDefault(); closeMap(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<div class="app">
  {#if !zenMode}
    <header>
    <div class="brand"><img class="brand-logo" src={logoUrl} alt="" /><span>VynMindMap</span></div>

    <div class="group">
      <button class="ic" onclick={newMap} title="New map (Ctrl+N)" aria-label="New"><Icon name="file-plus" /></button>
      <button class="ic" onclick={openFile} title="Open…  (Ctrl+O)" aria-label="Open"><Icon name="folder-open" /></button>
      <button class="ic" onclick={() => save()} disabled={!workbook} title="Save (Ctrl+S)" aria-label="Save"><Icon name="save" /></button>
      <button class="ic" onclick={saveAs} disabled={!workbook} title="Save As… (Ctrl+Shift+S)" aria-label="Save As"><Icon name="save-as" /></button>
      <button class="ic" onclick={closeMap} disabled={!workbook} title="Close map — back to home (Ctrl+W)" aria-label="Close map"><Icon name="x" /></button>
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

    <div class="divider"></div>
    <div class="group">
      <button class="ic" class:on={showOutline} onclick={() => (showOutline = !showOutline)} disabled={!workbook}
        title="Toggle outline panel" aria-label="Outline" aria-pressed={showOutline}><Icon name="list" /></button>
      <button class="ic" class:on={showInspector} onclick={() => (showInspector = !showInspector)} disabled={!workbook}
        title="Toggle style panel" aria-label="Style panel" aria-pressed={showInspector}><Icon name="panel-right" /></button>
      <button class="ic" class:on={zenMode} onclick={() => (zenMode = !zenMode)} disabled={!workbook}
        title="Full Window Mode (F8)" aria-label="Full Window" aria-pressed={zenMode}><Icon name="maximize" /></button>
      <button class="ic" class:on={autosave} onclick={() => { autosave = !autosave; if (autosave && dirty) scheduleAutosave(); }}
        title={autosave ? "Autosave is on (saves shortly after each change once a file is set)" : "Autosave is off"}
        aria-label="Autosave" aria-pressed={autosave}><Icon name="autosave" /></button>
      <button class="ic" onclick={() => (theme = theme === "dark" ? "light" : "dark")}
        title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        aria-label="Theme"><Icon name={theme === "dark" ? "sun" : "moon"} /></button>
      <button class="ic" onclick={checkUpdatesNow} disabled={checkingUpdate}
        title="Check for updates" aria-label="Check for updates"><Icon name="cloud-download" /></button>
    </div>

    <input bind:this={fileInput} type="file" accept=".vmm" onchange={onPick} hidden />
    <input bind:this={mdInput} type="file" accept=".md,.markdown,text/markdown" onchange={onPickMarkdown} hidden />

    {#if fileName}<span class="file">{#if dirty}<span class="dot" title="Unsaved changes"></span>{/if}{fileName}</span>{/if}
    </header>
  {/if}

  {#if update}
    <div class="banner update">
      <span><strong>Update available</strong> — VynMindMap v{update.version} is out.</span>
      <span class="update-actions">
        <button class="update-btn" onclick={() => update && openExternal(update.url)}>Download</button>
        <button class="update-dismiss" onclick={() => (update = null)} aria-label="Dismiss">✕</button>
      </span>
    </div>
  {:else if checkingUpdate}
    <div class="banner update"><span>Checking for updates…</span></div>
  {:else if updateMsg}
    <div class="banner update">
      <span>{updateMsg}</span>
      <span class="update-actions">
        <button class="update-dismiss" onclick={() => (updateMsg = "")} aria-label="Dismiss">✕</button>
      </span>
    </div>
  {/if}
  {#if warning}<div class="banner warn">{warning}</div>{/if}
  {#if error}<div class="banner err">⚠ {error}</div>{/if}
  {#if extChange}
    <div class="banner warn extchange">
      <span><strong>File changed on disk</strong> — this map was edited outside the app.</span>
      <span class="update-actions">
        <button class="update-btn" onclick={() => { if (currentPath) openNativePath(currentPath); }}>Reload from disk</button>
        <button class="update-dismiss" onclick={() => (extChange = false)}>Keep my version</button>
      </span>
    </div>
  {/if}

  {#if workbook}
    {#if !zenMode}
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
    {/if}
    <div class="workspace">
      {#if showOutline && !zenMode && sheet}
        <OutlinePanel {sheet} bind:selectedId {markDirty} reveal={(id) => view?.centerOn(id)} />
      {/if}
      <div class="viewport" bind:this={viewportEl}>
        {#if sheet}
          <MindMapView bind:this={view} {sheet} {resources} {markDirty} bind:selectedId />
        {/if}
        {#if zenMode}
          <button class="zen-toggle exit" title="Exit full window (F8)" onclick={() => (zenMode = false)}>
            <Icon name="minimize" size={18} />
          </button>
        {/if}
      </div>
      {#if sheet && showInspector && !zenMode}
        <Inspector {sheet} topic={selectedTopic} {markDirty} onClose={() => (showInspector = false)} />
      {:else if sheet && !zenMode}
        <button class="inspector-open" title="Open style panel" aria-label="Open style panel"
          onclick={() => (showInspector = true)}><Icon name="sliders" size={18} /></button>
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
      {#if recents.length}
        <div class="samples">
          <div class="samples-label">Recent files</div>
          <div class="recent-list">
            {#each recents as r (r.kind + (r.path ?? r.name) + r.when)}
              <div class="recent">
                <button class="recent-main" onclick={() => openRecent(r)} title={r.path ?? r.name}>
                  <span class="recent-icon"><Icon name="clock" size={17} /></span>
                  <span class="recent-text">
                    <strong>{r.name}</strong>
                    <small>{r.kind === "path" ? r.path : "browser file"} · {relTime(r.when)}</small>
                  </span>
                </button>
                <button class="recent-x" title="Remove from recent files" aria-label="Remove"
                  onclick={() => dropRecent(r)}>×</button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

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

  <ConfirmHost />
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
  header button.on { background: rgba(255, 255, 255, 0.26); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35); }
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
  .banner.warn { background: var(--warn-bg); color: var(--warn-fg); border-bottom: 1px solid var(--warn-border); }
  .banner.err { background: var(--err-bg); color: var(--err-fg); border-bottom: 1px solid var(--err-border); }
  .banner.extchange { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .banner.update {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    background: color-mix(in srgb, var(--accent) 12%, var(--panel)); color: var(--text);
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
  .workspace { flex: 1; display: flex; min-height: 0; position: relative; }
  .viewport { position: relative; flex: 1; min-height: 0; min-width: 0; }

  /* Floating button to reopen the style panel once it's been collapsed. */
  .inspector-open {
    position: absolute; top: 12px; right: 12px; z-index: 5;
    width: 38px; height: 38px; padding: 0; border-radius: 10px;
    display: grid; place-items: center;
    background: var(--panel); color: var(--accent);
    border: 1px solid var(--border); box-shadow: var(--elev-2);
  }
  .inspector-open:hover:not(:disabled) { background: var(--surface-2); }
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

  /* Recent files on the welcome screen */
  .recent-list { display: flex; flex-direction: column; gap: 8px; }
  .recent {
    display: flex; align-items: stretch; gap: 0;
    border: 1px solid var(--border); border-radius: 12px;
    background: var(--panel); box-shadow: var(--elev-1); overflow: hidden;
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .recent:hover { box-shadow: var(--elev-2); border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
  .recent-main {
    flex: 1; display: flex; align-items: center; gap: 12px; min-width: 0;
    border: none; border-radius: 0; background: transparent; color: var(--text);
    padding: 10px 12px; text-align: left;
  }
  .recent-icon {
    width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center;
    color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); flex: none;
  }
  .recent-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .recent-text strong { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .recent-text small { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .recent-x {
    border: none; border-radius: 0; background: transparent; color: var(--muted);
    padding: 0 14px; font-size: 16px; line-height: 1;
  }
  .recent-x:hover:not(:disabled) { color: #c0392b; background: color-mix(in srgb, #c0392b 8%, transparent); }

  .zen-toggle.exit {
    position: absolute; top: 12px; left: 12px; z-index: 10;
    width: 38px; height: 38px; padding: 0; border-radius: 10px;
    display: grid; place-items: center;
    background: var(--panel); color: var(--accent);
    border: 1px solid var(--border); box-shadow: var(--elev-2);
    cursor: pointer;
  }
  .zen-toggle.exit:hover { background: var(--surface-2); }
</style>
