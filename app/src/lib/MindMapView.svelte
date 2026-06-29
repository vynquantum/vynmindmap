<script lang="ts">
  import type { Sheet, Topic } from "../../../src/index.js";
  import {
    addChild, addSibling, addBoundary, addFloatingTopic, addRelationship, addSummary,
    deleteTopic, editText, findTopic, findWithParent, moveTopic, toggleCollapse,
    removeBoundary, removeRelationship, removeSummary,
  } from "../../../src/index.js";
  import { layoutSheet, edgePath, summaryPath, type Layout, type LaidOutNode } from "./layout.js";

  let {
    sheet,
    markDirty,
    resources = {},
    selectedId = $bindable(null),
  }: {
    sheet: Sheet;
    markDirty: () => void;
    resources?: Record<string, Uint8Array>;
    selectedId?: string | null;
  } = $props();

  // Layout recomputes whenever the (proxied) sheet mutates.
  const layout: Layout = $derived(layoutSheet(sheet));

  // View transform.
  let scale = $state(1);
  let tx = $state(0);
  let ty = $state(0);

  // Interaction state.
  let selection = $state<string[]>([]); // multi-select (primary = last)
  let selectedDeco = $state<{ type: "rel" | "boundary" | "summary"; id: string } | null>(null);
  let relMode = $state(false);
  let relSourceId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let editValue = $state("");
  let panning = $state(false);
  let editInput = $state<HTMLInputElement | null>(null);
  let svgEl = $state<SVGSVGElement | null>(null);
  let canvasEl = $state<HTMLDivElement | null>(null);
  let viewW = $state(0);
  let viewH = $state(0);

  // Drag-to-reparent state.
  let dragId = $state<string | null>(null);
  let dragOverId = $state<string | null>(null);
  let dropMode = $state<"child" | "before" | "after">("child");
  let pressed = $state<{ id: string; sx: number; sy: number } | null>(null);
  let lastPoint = { x: 0, y: 0 };

  let startX = 0, startY = 0, startTx = 0, startTy = 0;

  const nodeById = $derived(new Map(layout.nodes.map((n) => [n.id, n])));

  // --- helpers --------------------------------------------------------------
  function notify() { markDirty(); }

  function canvasPoint(e: PointerEvent, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    return { x: (e.clientX - r.left - tx) / scale, y: (e.clientY - r.top - ty) / scale };
  }

  function nodeAt(cx: number, cy: number): LaidOutNode | undefined {
    // Topmost match (nodes drawn last are on top → iterate from the end).
    for (let i = layout.nodes.length - 1; i >= 0; i--) {
      const n = layout.nodes[i]!;
      if (cx >= n.x && cx <= n.x + n.w && cy >= n.y && cy <= n.y + n.h) return n;
    }
    return undefined;
  }

  function isDescendant(rootId: string, candidateId: string): boolean {
    const root = findTopic(sheet, rootId);
    if (!root) return false;
    const stack: Topic[] = [root];
    while (stack.length) {
      const t = stack.pop()!;
      if (t.id === candidateId) return true;
      for (const c of t.children ?? []) stack.push(c);
    }
    return false;
  }

  // --- pan & zoom -----------------------------------------------------------
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const next = Math.min(4, Math.max(0.15, scale * factor));
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    tx = mx - (mx - tx) * (next / scale);
    ty = my - (my - ty) * (next / scale);
    scale = next;
  }

  function onBgPointerDown(e: PointerEvent) {
    // Background press → pan + clear selection.
    panning = true;
    clearSelection();
    relMode = false; relSourceId = null;
    startX = e.clientX; startY = e.clientY; startTx = tx; startTy = ty;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function clearSelection() {
    selection = [];
    selectedId = null;
    selectedDeco = null;
  }
  function selectOnly(id: string) {
    selection = [id];
    selectedId = id;
    selectedDeco = null;
  }
  function toggleInSelection(id: string) {
    const i = selection.indexOf(id);
    if (i >= 0) selection.splice(i, 1); else selection.push(id);
    selectedId = selection[selection.length - 1] ?? null;
    selectedDeco = null;
  }
  function inSelection(id: string) { return selection.includes(id); }
  function isFloatingRoot(id: string) { return (sheet.floatingTopics ?? []).some((f) => f.id === id); }

  function onCanvasDblClick(e: MouseEvent) {
    // Reaches here only for empty canvas (node/decoration dblclicks stop propagation).
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = (e.clientX - r.left - tx) / scale;
    const cy = (e.clientY - r.top - ty) / scale;
    const pos = { x: cx - layout.shiftX - 50, y: cy - layout.shiftY - 17 };
    const t = addFloatingTopic(sheet, "Floating topic", pos);
    notify();
    beginEdit(t.id);
  }

  function onContainerPointerMove(e: PointerEvent) {
    if (pressed) {
      // Promote a press into a drag once the pointer moves enough.
      const moved = Math.hypot(e.clientX - pressed.sx, e.clientY - pressed.sy);
      if (moved > 4) { dragId = pressed.id; pressed = null; }
    }
    if (dragId) {
      const p = canvasPoint(e, e.currentTarget as HTMLElement);
      lastPoint = p;
      const over = nodeAt(p.x, p.y);
      if (over && over.id !== dragId && !isDescendant(dragId, over.id)) {
        dragOverId = over.id;
        const rel = (p.y - over.y) / over.h;
        const hasParent = !!findWithParent(sheet, over.id)?.parent;
        dropMode = !hasParent ? "child" : rel < 0.3 ? "before" : rel > 0.7 ? "after" : "child";
      } else {
        dragOverId = null;
      }
      return;
    }
    if (panning) {
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
    }
  }

  function onContainerPointerUp() {
    if (dragId) {
      if (!dragOverId && isFloatingRoot(dragId)) {
        // Reposition a floating topic to where it was dropped.
        const node = nodeById.get(dragId);
        const f = (sheet.floatingTopics ?? []).find((t) => t.id === dragId);
        if (f && node) {
          f.position = {
            x: lastPoint.x - layout.shiftX - node.w / 2,
            y: lastPoint.y - layout.shiftY - node.h / 2,
          };
          notify();
        }
        dragId = null; dragOverId = null; pressed = null; panning = false;
        return;
      }
      if (dragOverId) {
        try {
          if (dropMode === "child") {
            moveTopic(sheet, dragId, dragOverId);
          } else {
            const fp = findWithParent(sheet, dragOverId);
            if (fp?.parent) {
              const sibs = fp.parent.children!;
              let idx = sibs.findIndex((c) => c.id === dragOverId);
              if (dropMode === "after") idx += 1;
              moveTopic(sheet, dragId, fp.parent.id, idx);
            } else {
              moveTopic(sheet, dragId, dragOverId);
            }
          }
          notify();
        } catch { /* invalid move (e.g. into descendant) — ignore */ }
      }
      dragId = null; dragOverId = null;
    }
    pressed = null;
    panning = false;
  }

  // --- node interaction -----------------------------------------------------
  function onNodePointerDown(e: PointerEvent, id: string) {
    e.stopPropagation();
    if (relMode && relSourceId && id !== relSourceId) {
      try { addRelationship(sheet, relSourceId, id); notify(); } catch { /* ignore */ }
      relMode = false; relSourceId = null;
      return;
    }
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      toggleInSelection(id);
      return; // multi-select doesn't start a drag
    }
    selectOnly(id);
    pressed = { id, sx: e.clientX, sy: e.clientY };
  }

  function onToggle(e: PointerEvent, t: Topic) {
    e.stopPropagation();
    toggleCollapse(t);
    notify();
  }

  // --- editing --------------------------------------------------------------
  function beginEdit(id: string) {
    const t = findTopic(sheet, id);
    if (!t) return;
    selectedId = id;
    editValue = t.title;
    editingId = id;
    requestAnimationFrame(() => { editInput?.focus(); editInput?.select(); });
  }

  function commitEdit() {
    if (editingId) {
      const t = findTopic(sheet, editingId);
      if (t && t.title !== editValue) { editText(t, editValue); notify(); }
    }
    editingId = null;
  }

  function cancelEdit() { editingId = null; }

  function onEditKey(e: KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
    else if (e.key === "Tab") { e.preventDefault(); commitEdit(); }
  }

  // --- structural ops -------------------------------------------------------
  function addChildToSelected() {
    if (!selectedId) return;
    const parent = findTopic(sheet, selectedId);
    if (!parent) return;
    if (parent.collapsed) toggleCollapse(parent);
    const child = addChild(parent, "New topic");
    notify();
    beginEdit(child.id);
  }

  function addSiblingToSelected() {
    if (!selectedId) return;
    try {
      const sib = addSibling(sheet, selectedId, "New topic");
      notify();
      beginEdit(sib.id);
    } catch {
      // Root has no siblings → fall back to adding a child.
      addChildToSelected();
    }
  }

  function deleteSelected() {
    if (selectedDeco) {
      const { type, id } = selectedDeco;
      if (type === "rel") removeRelationship(sheet, id);
      else if (type === "boundary") removeBoundary(sheet, id);
      else removeSummary(sheet, id);
      selectedDeco = null;
      notify();
      return;
    }
    const ids = selection.length ? [...selection] : selectedId ? [selectedId] : [];
    if (!ids.length) return;
    const next = findWithParent(sheet, ids[0]!)?.parent?.id ?? null;
    let deleted = false;
    for (const id of ids) {
      try { if (deleteTopic(sheet, id)) deleted = true; } catch { /* central root */ }
    }
    if (deleted) { notify(); selection = []; selectedId = next; }
  }

  function collapseSelected() {
    if (!selectedId) return;
    const t = findTopic(sheet, selectedId);
    if (t && (t.children?.length ?? 0) > 0) { toggleCollapse(t); notify(); }
  }

  // --- keyboard navigation --------------------------------------------------
  function navigate(key: string) {
    if (!selectedId) return;
    const node = nodeById.get(selectedId);
    const fp = findWithParent(sheet, selectedId);
    if (!node) return;
    const goInward = (node.side === "left") ? "ArrowLeft" : "ArrowRight";
    const goOutward = (node.side === "left") ? "ArrowRight" : "ArrowLeft";

    if (key === goInward) {
      const first = findTopic(sheet, selectedId)?.children?.[0];
      if (first) selectedId = first.id;
    } else if (key === goOutward) {
      if (fp?.parent) selectedId = fp.parent.id;
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      const sibs = fp?.parent?.children ?? (node.side !== "root" ? sheet.rootTopic.children : []);
      if (!sibs) return;
      const idx = sibs.findIndex((c) => c.id === selectedId);
      const nextIdx = key === "ArrowUp" ? idx - 1 : idx + 1;
      if (idx !== -1 && sibs[nextIdx]) selectedId = sibs[nextIdx]!.id;
    }
  }

  // --- global keyboard ------------------------------------------------------
  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (editingId) return; // the edit input owns keys while editing
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        e.preventDefault(); relMode = false; relSourceId = null; clearSelection(); return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault(); deleteSelected(); return;
      }
      if (!selectedId) return;
      switch (e.key) {
        case "Tab": e.preventDefault(); addChildToSelected(); break;
        case "Enter": e.preventDefault(); addSiblingToSelected(); break;
        case "F2": e.preventDefault(); beginEdit(selectedId); break;
        case " ": e.preventDefault(); collapseSelected(); break;
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown": e.preventDefault(); navigate(e.key); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Keep multi-select array in sync with the (bindable) primary selection.
  $effect(() => {
    if (selectedId === null) { if (selection.length) selection = []; }
    else if (!selection.includes(selectedId)) selection = [selectedId];
  });

  // A contiguous sibling group, eligible for a boundary or summary.
  const groupSel = $derived.by(() => {
    if (selection.length < 2) return null;
    let parentId: string | undefined;
    const idxs: number[] = [];
    for (const id of selection) {
      const fp = findWithParent(sheet, id);
      if (!fp?.parent) return null;
      if (parentId === undefined) parentId = fp.parent.id;
      else if (parentId !== fp.parent.id) return null;
      idxs.push(fp.parent.children!.findIndex((c) => c.id === id));
    }
    idxs.sort((a, b) => a - b);
    for (let k = 1; k < idxs.length; k++) if (idxs[k] !== idxs[k - 1]! + 1) return null;
    const parent = findTopic(sheet, parentId!)!;
    return { parentId: parentId!, childIds: idxs.map((i) => parent.children![i]!.id) };
  });

  function selectDeco(type: "rel" | "boundary" | "summary", id: string) {
    clearSelection();
    selectedDeco = { type, id };
  }
  function startRelate() { if (selectedId) { relMode = true; relSourceId = selectedId; } }
  function makeBoundary() {
    const g = groupSel;
    if (g) { try { addBoundary(sheet, g.parentId, g.childIds); notify(); clearSelection(); } catch { /* */ } }
  }
  function makeSummary() {
    const g = groupSel;
    if (g) { try { addSummary(sheet, g.parentId, g.childIds, "Summary"); notify(); clearSelection(); } catch { /* */ } }
  }

  // Track viewport size for the minimap + viewport rectangle.
  $effect(() => {
    if (!canvasEl) return;
    const el = canvasEl;
    const ro = new ResizeObserver(() => { viewW = el.clientWidth; viewH = el.clientHeight; });
    ro.observe(el);
    viewW = el.clientWidth; viewH = el.clientHeight;
    return () => ro.disconnect();
  });

  const MM_W = 190, MM_H = 130;
  const mini = $derived.by(() => {
    const s = Math.min(MM_W / Math.max(1, layout.width), MM_H / Math.max(1, layout.height));
    return { s, w: layout.width * s, h: layout.height * s };
  });
  function onMinimapDown(e: PointerEvent) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const lx = (e.clientX - r.left) / mini.s;
    const ly = (e.clientY - r.top) / mini.s;
    tx = viewW / 2 - lx * scale;
    ty = viewH / 2 - ly * scale;
  }

  // --- public ---------------------------------------------------------------
  export function fit(vw: number, vh: number) {
    const s = Math.min(vw / layout.width, vh / layout.height, 1.5);
    scale = s;
    tx = (vw - layout.width * s) / 2;
    ty = (vh - layout.height * s) / 2;
  }

  /** Rasterize the current sheet to a canvas (white background, 2× scale). */
  async function renderCanvas(): Promise<{ canvas: HTMLCanvasElement; W: number; H: number } | null> {
    if (!svgEl) return null;
    const W = Math.ceil(layout.width), H = Math.ceil(layout.height);
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    const g = clone.querySelector("g");
    if (g) g.setAttribute("transform", "translate(0,0) scale(1)");
    clone.setAttribute("width", String(W));
    clone.setAttribute("height", String(H));
    clone.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const ns = "http://www.w3.org/2000/svg";
    const bg = document.createElementNS(ns, "rect");
    bg.setAttribute("width", String(W));
    bg.setAttribute("height", String(H));
    bg.setAttribute("fill", sheet.background?.color ?? "#ffffff");
    clone.insertBefore(bg, clone.firstChild);

    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const f = 2;
    const canvas = document.createElement("canvas");
    canvas.width = W * f; canvas.height = H * f;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(f, f);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    return { canvas, W, H };
  }

  function download(blob: Blob, name: string) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u; a.download = name; a.click();
    URL.revokeObjectURL(u);
  }

  /** Rasterize the current sheet to a PNG and download it. */
  export async function exportPng() {
    const r = await renderCanvas();
    if (!r) return;
    r.canvas.toBlob((blob) => { if (blob) download(blob, `${sheet.title || "mindmap"}.png`); }, "image/png");
  }

  /** Export the current sheet as a single-page PDF (embedded JPEG). */
  export async function exportPdf() {
    const r = await renderCanvas();
    if (!r) return;
    const jpegBlob = await new Promise<Blob | null>((res) => r.canvas.toBlob(res, "image/jpeg", 0.92));
    if (!jpegBlob) return;
    const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
    const pdf = buildPdf(jpeg, r.canvas.width, r.canvas.height, r.W, r.H);
    download(new Blob([pdf as BlobPart], { type: "application/pdf" }), `${sheet.title || "mindmap"}.pdf`);
  }

  function buildPdf(jpeg: Uint8Array, iw: number, ih: number, pw: number, ph: number): Uint8Array {
    const enc = (s: string) => new TextEncoder().encode(s);
    const parts: Uint8Array[] = [];
    const offsets: number[] = [];
    let len = 0;
    const push = (c: Uint8Array) => { parts.push(c); len += c.length; };
    const str = (s: string) => push(enc(s));
    const obj = () => offsets.push(len);

    str("%PDF-1.3\n");
    obj(); str("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    obj(); str("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    obj(); str(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
    obj(); str(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg); str("\nendstream\nendobj\n");
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(); str(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    const xrefAt = len;
    let xref = "xref\n0 6\n0000000000 65535 f \n";
    for (const o of offsets) xref += String(o).padStart(10, "0") + " 00000 n \n";
    str(xref);
    str(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);

    const out = new Uint8Array(len);
    let off = 0;
    for (const c of parts) { out.set(c, off); off += c.length; }
    return out;
  }

  function hasChildren(t: Topic) { return (t.children?.length ?? 0) > 0; }

  const SUMMARY_STROKE = "#94a3b8";

  // Embedded image resources → data URLs (cached; cleared when resources change).
  const imgCache = new Map<string, string>();
  $effect(() => { resources; imgCache.clear(); });
  function imgUrl(path: string): string | null {
    if (imgCache.has(path)) return imgCache.get(path)!;
    const bytes = resources[path];
    if (!bytes) return null;
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    const mime = path.endsWith(".png") ? "image/png"
      : /\.jpe?g$/.test(path) ? "image/jpeg"
      : path.endsWith(".gif") ? "image/gif"
      : path.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
    const url = `data:${mime};base64,${btoa(bin)}`;
    imgCache.set(path, url);
    return url;
  }
  function imgSize(n: LaidOutNode): { w: number; h: number } {
    const img = n.topic.image!;
    const w = Math.min(img.width ?? 96, 120);
    const h = Math.min(img.height ?? 64, 90);
    return { w, h };
  }

  // --- styling / decoration helpers ----------------------------------------
  function nodeFill(n: LaidOutNode): string {
    return n.topic.style?.fillColor ?? (n.depth === 0 ? n.color : "#ffffff");
  }
  function nodeStroke(n: LaidOutNode): string {
    if (n.id === dragOverId && dropMode === "child") return "#16a34a";
    if (relMode && n.id === relSourceId) return "#9333ea";
    if (n.id === selectedId) return "#1d4ed8";
    if (inSelection(n.id)) return "#60a5fa";
    return n.topic.style?.borderColor ?? n.color;
  }
  function nodeStrokeWidth(n: LaidOutNode): number {
    if (n.id === selectedId || (n.id === dragOverId && dropMode === "child")) return 3;
    if (inSelection(n.id)) return 2.5;
    if (n.topic.style?.shape === "none") return 0;
    return n.depth === 0 && !n.topic.style?.fillColor ? 0 : (n.topic.style?.borderWidth ?? 1.5);
  }
  function textFill(n: LaidOutNode): string {
    return n.topic.style?.font?.color ?? (n.depth === 0 || isDark(nodeFill(n)) ? "#ffffff" : "#1c2230");
  }
  function isDark(hex: string): boolean {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return false;
    const n = parseInt(m[1]!, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 0.299 * r + 0.587 * g + 0.114 * b < 140;
  }
  function rxFor(n: LaidOutNode): number {
    const shape = n.topic.style?.shape ?? "rounded";
    if (shape === "rect") return 0;
    if (shape === "capsule") return n.h / 2;
    return 8;
  }
  const MARKER_ICONS: Record<string, string> = {
    "flag-red": "🚩", "flag-green": "🏁", star: "⭐", "star-yellow": "⭐",
    "task-done": "✅", "task-start": "🔵", "task-25%": "◔", "task-50%": "◑", "task-75%": "◕",
    idea: "💡", question: "❓", people: "👤", smiley: "🙂",
  };
  function markerIcon(id: string): string {
    if (id.startsWith("priority-")) return id.slice("priority-".length);
    return MARKER_ICONS[id] ?? "●";
  }
  function badges(t: Topic): string {
    let s = "";
    if (t.note?.plain) s += "📝";
    if (t.hyperlink?.value) s += "🔗";
    if (t.image?.resource) s += "🖼";
    return s;
  }

  // Relationship cross-links (curved, bowed connectors between any two topics).
  const relationships = $derived.by(() => {
    const out: { id: string; d: string; lx: number; ly: number; title?: string }[] = [];
    for (const rel of sheet.relationships ?? []) {
      const a = nodeById.get(rel.end1Id);
      const b = nodeById.get(rel.end2Id);
      if (!a || !b) continue;
      const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
      const bx = b.x + b.w / 2, by = b.y + b.h / 2;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const off = 44;
      const cx = mx + (-dy / len) * off, cy = my + (dx / len) * off;
      out.push({ id: rel.id, d: `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`, lx: cx, ly: cy, title: rel.title });
    }
    return out;
  });

  // Geometry for the inline edit overlay (screen coordinates).
  const editBox = $derived.by(() => {
    if (!editingId) return null;
    const n = nodeById.get(editingId);
    if (!n) return null;
    return { left: n.x * scale + tx, top: n.y * scale + ty, w: n.w * scale, h: n.h * scale };
  });
</script>

<div
  bind:this={canvasEl}
  class="canvas"
  role="application"
  style={`background-color:${sheet.background?.color ?? "#f5f6f8"}`}
  ondblclick={onCanvasDblClick}
  onwheel={onWheel}
  onpointerdown={onBgPointerDown}
  onpointermove={onContainerPointerMove}
  onpointerup={onContainerPointerUp}
  onpointercancel={onContainerPointerUp}
  class:panning
  class:dragging={dragId !== null}
>
  <svg bind:this={svgEl} width="100%" height="100%">
    <defs>
      <marker id="rel-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
      </marker>
    </defs>
    <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
      {#each layout.boundaries as b (b.id)}
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="14"
          fill={b.color} fill-opacity={selectedDeco?.id === b.id ? 0.16 : 0.08}
          stroke={selectedDeco?.id === b.id ? "#1d4ed8" : b.color}
          stroke-opacity={selectedDeco?.id === b.id ? 1 : 0.5}
          stroke-width={selectedDeco?.id === b.id ? 2.5 : 1.5} stroke-dasharray="7 5"
          role="button" tabindex={-1}
          onpointerdown={(e) => { e.stopPropagation(); selectDeco("boundary", b.id); }} />
        {#if b.title}
          <text x={b.x + 10} y={b.y - 5} font-size="11" fill={b.color}>{b.title}</text>
        {/if}
      {/each}

      {#each layout.gridLines as l, li (li)}
        <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#cbd2dc" stroke-width="1" />
      {/each}

      {#each layout.braces as br (br.id)}
        <path d={summaryPath(br)} fill="none" stroke={SUMMARY_STROKE} stroke-width="2" />
      {/each}

      {#each layout.summaries as sm (sm.id)}
        <path d={summaryPath(sm)} fill="none"
          stroke={selectedDeco?.id === sm.id ? "#1d4ed8" : SUMMARY_STROKE}
          stroke-width={selectedDeco?.id === sm.id ? 3 : 2}
          role="button" tabindex={-1}
          onpointerdown={(e) => { e.stopPropagation(); selectDeco("summary", sm.id); }} />
      {/each}

      {#each layout.edges as e (e.id)}
        <path d={edgePath(e)} fill="none" stroke={e.color} stroke-width={e.width ?? 2.5} />
      {/each}

      <!-- Relationships render below nodes so node clicks win near endpoints. -->
      {#each relationships as r (r.id)}
        <path d={r.d} fill="none" stroke="transparent" stroke-width="12"
          style="cursor:pointer" role="button" tabindex={-1}
          onpointerdown={(e) => { e.stopPropagation(); selectDeco("rel", r.id); }} />
        <path d={r.d} fill="none"
          stroke={selectedDeco?.id === r.id ? "#1d4ed8" : "#94a3b8"}
          stroke-width={selectedDeco?.id === r.id ? 3 : 2}
          stroke-dasharray="6 4" marker-end="url(#rel-arrow)" pointer-events="none" />
        {#if r.title}
          <text x={r.lx} y={r.ly} font-size="11" text-anchor="middle"
            dominant-baseline="central" fill="#64748b" pointer-events="none">{r.title}</text>
        {/if}
      {/each}

      {#each layout.nodes as n (n.id)}
        <g
          transform={`translate(${n.x} ${n.y})`}
          class="node"
          role="button"
          tabindex={-1}
          aria-label={n.topic.title}
          class:selected={n.id === selectedId}
          class:dragover={n.id === dragOverId}
          class:ghost={n.id === dragId}
          onpointerdown={(e) => onNodePointerDown(e, n.id)}
          ondblclick={(e) => { e.stopPropagation(); beginEdit(n.id); }}
        >
          {#if n.topic.style?.shape === "ellipse"}
            <ellipse cx={n.w / 2} cy={n.h / 2} rx={n.w / 2} ry={n.h / 2}
              fill={nodeFill(n)} stroke={nodeStroke(n)} stroke-width={nodeStrokeWidth(n)} />
          {:else if n.topic.style?.shape === "underline"}
            <line x1="0" y1={n.h} x2={n.w} y2={n.h} stroke={nodeStroke(n)} stroke-width="2" />
            {#if n.id === selectedId}
              <rect width={n.w} height={n.h} rx="6" fill="none" stroke="#1d4ed8" stroke-width="2" stroke-dasharray="3 3" />
            {/if}
          {:else}
            <rect
              width={n.w} height={n.h} rx={rxFor(n)} ry={rxFor(n)}
              fill={nodeFill(n)} stroke={nodeStroke(n)} stroke-width={nodeStrokeWidth(n)} />
          {/if}

          <text
            x={n.w / 2} y={n.h / 2}
            dominant-baseline="central" text-anchor="middle"
            font-family={n.topic.style?.font?.family ?? "inherit"}
            font-size={n.topic.style?.font?.size ?? (n.depth === 0 ? 15 : 13)}
            font-weight={n.topic.style?.font?.weight ?? (n.depth === 0 ? "700" : n.depth === 1 ? "600" : "400")}
            font-style={n.topic.style?.font?.style ?? "normal"}
            text-decoration={n.topic.style?.font?.decoration ?? "none"}
            fill={textFill(n)}
          >{n.id === editingId ? "" : n.topic.title}</text>

          {#if n.topic.image && imgUrl(n.topic.image.resource)}
            {@const sz = imgSize(n)}
            <image href={imgUrl(n.topic.image.resource)} x={(n.w - sz.w) / 2}
              y={-(sz.h + 6)} width={sz.w} height={sz.h} preserveAspectRatio="xMidYMid meet" />
          {/if}

          {#if n.topic.markers?.length}
            <g transform={`translate(2 -6)`}>
              {#each n.topic.markers as mk, mi (mk)}
                <text x={mi * 16} y="0" font-size="13" text-anchor="start">{markerIcon(mk)}</text>
              {/each}
            </g>
          {/if}
          {#if badges(n.topic)}
            <text x={n.w - 2} y={n.h + 12} font-size="11" text-anchor="end">{badges(n.topic)}</text>
          {/if}
          {#if n.topic.labels?.length}
            <text x="2" y={n.h + 12} font-size="10" text-anchor="start" fill="#6b7280">{n.topic.labels.join(" · ")}</text>
          {/if}

          {#if hasChildren(n.topic)}
            <g
              class="toggle"
              role="button"
              tabindex={-1}
              aria-label={n.topic.collapsed ? "Expand" : "Collapse"}
              onpointerdown={(e) => onToggle(e, n.topic)}
              transform={`translate(${n.side === "left" ? -9 : n.w + 9} ${n.h / 2})`}
            >
              <circle r="7" fill="#fff" stroke={n.color} stroke-width="1.5" />
              <text dominant-baseline="central" text-anchor="middle" font-size="11" fill={n.color}>
                {n.topic.collapsed ? "+" : "−"}
              </text>
            </g>
          {/if}
        </g>
      {/each}

      {#if dragId && dragOverId && dropMode !== "child"}
        {@const t = nodeById.get(dragOverId)}
        {#if t}
          <line x1={t.x - 6} x2={t.x + t.w + 6}
            y1={dropMode === "before" ? t.y - 4 : t.y + t.h + 4}
            y2={dropMode === "before" ? t.y - 4 : t.y + t.h + 4}
            stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" />
        {/if}
      {/if}
    </g>
  </svg>

  {#if editBox}
    <input
      class="edit"
      bind:this={editInput}
      bind:value={editValue}
      style={`left:${editBox.left}px; top:${editBox.top}px; width:${Math.max(80, editBox.w)}px; height:${editBox.h}px; font-size:${13 * scale}px;`}
      onkeydown={onEditKey}
      onblur={commitEdit}
      onpointerdown={(e) => e.stopPropagation()}
    />
  {/if}

  {#if relMode}
    <div class="actionbar rel" role="toolbar" tabindex={-1} onpointerdown={(e) => e.stopPropagation()}>Click a target topic to link to… <button onclick={() => { relMode = false; relSourceId = null; }}>Cancel</button></div>
  {:else if groupSel}
    <div class="actionbar" role="toolbar" tabindex={-1} onpointerdown={(e) => e.stopPropagation()}>
      <span>{selection.length} topics</span>
      <button onclick={makeBoundary}>Add boundary</button>
      <button onclick={makeSummary}>Add summary</button>
    </div>
  {:else if selectedId && selection.length === 1}
    <div class="actionbar" role="toolbar" tabindex={-1} onpointerdown={(e) => e.stopPropagation()}>
      <button onclick={startRelate}>Relate →</button>
    </div>
  {:else if selectedDeco}
    <div class="actionbar" role="toolbar" tabindex={-1} onpointerdown={(e) => e.stopPropagation()}>
      <span>{selectedDeco.type} selected</span>
      <button onclick={deleteSelected}>Delete</button>
    </div>
  {/if}

  {#if layout.nodes.length > 1}
    <svg class="minimap" width={mini.w} height={mini.h} viewBox={`0 0 ${mini.w} ${mini.h}`}
      role="application" onpointerdown={onMinimapDown}>
      <rect x="0" y="0" width={mini.w} height={mini.h} fill="#ffffff" />
      {#each layout.nodes as n (n.id)}
        <rect x={n.x * mini.s} y={n.y * mini.s} width={Math.max(1, n.w * mini.s)}
          height={Math.max(1, n.h * mini.s)} fill={n.color} rx="1" />
      {/each}
      {#if viewW > 0}
        <rect x={(-tx / scale) * mini.s} y={(-ty / scale) * mini.s}
          width={(viewW / scale) * mini.s} height={(viewH / scale) * mini.s}
          fill="rgba(31,79,208,0.12)" stroke="#1d4ed8" stroke-width="1.5" />
      {/if}
    </svg>
  {/if}

  <div class="hint">
    Tab: child · Enter: sibling · F2: rename · Del: delete · Ctrl-click: multi-select · drag: move
  </div>
</div>

<style>
  .canvas {
    position: relative;
    width: 100%; height: 100%;
    cursor: grab;
    background: radial-gradient(circle, #e7eaef 1px, transparent 1px) 0 0 / 24px 24px;
    touch-action: none; user-select: none;
    overflow: hidden;
  }
  .canvas.panning { cursor: grabbing; }
  .canvas.dragging { cursor: grabbing; }
  .node { cursor: pointer; }
  .node.ghost { opacity: 0.45; }
  .toggle { cursor: pointer; }
  text { pointer-events: none; }
  .toggle text { pointer-events: none; }

  .edit {
    position: absolute;
    box-sizing: border-box;
    border: 2px solid #1d4ed8;
    border-radius: 8px;
    padding: 0 8px;
    text-align: center;
    outline: none;
    background: #fff;
    color: #1c2230;
  }
  .hint {
    position: absolute;
    left: 50%; bottom: 10px; transform: translateX(-50%);
    background: rgba(28, 34, 48, 0.82); color: #fff;
    font-size: 12px; padding: 5px 12px; border-radius: 20px;
    pointer-events: none; white-space: nowrap;
  }
  .actionbar {
    position: absolute;
    left: 50%; top: 12px; transform: translateX(-50%);
    display: flex; align-items: center; gap: 8px;
    background: #fff; border: 1px solid var(--border); border-radius: 10px;
    padding: 6px 10px; font-size: 13px; box-shadow: 0 4px 14px rgba(0,0,0,0.08);
  }
  .actionbar span { color: var(--muted); }
  .actionbar button { padding: 4px 10px; font-size: 12px; }
  .actionbar.rel { background: #faf5ff; border-color: #d8b4fe; color: #6b21a8; }
  .minimap {
    position: absolute; right: 10px; bottom: 10px;
    border: 1px solid var(--border); border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); background: #fff; cursor: pointer;
  }
</style>
