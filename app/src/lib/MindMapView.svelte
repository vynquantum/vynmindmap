<script lang="ts" module>
  import type { Topic as ClipTopic } from "../../../src/index.js";
  // Session-wide clipboard for topic subtrees: survives sheet switches and
  // lets users copy across sheets in the same workbook.
  let clipboard = $state<ClipTopic[]>([]);
</script>

<script lang="ts">
  import type { Sheet, Topic } from "../../../src/index.js";
  import {
    addChild, addSibling, addBoundary, addFloatingTopic, addRelationship, addSummary,
    cloneTopicWithNewIds, deleteTopic, detachTopic, editText, findTopic, findWithParent,
    moveTopic, toggleCollapse, removeBoundary, removeRelationship, removeSummary,
    walkSheetTopics,
  } from "../../../src/index.js";
  import { layoutSheet, edgePath, summaryPath, type Layout, type LaidOutNode } from "./layout.js";

  let {
    sheet,
    markDirty,
    resources = {},
    selectedId = $bindable(null),
    presenterMode = false,
  }: {
    sheet: Sheet;
    markDirty: () => void;
    resources?: Record<string, Uint8Array>;
    selectedId?: string | null;
    presenterMode?: boolean;
  } = $props();

  // Layout recomputes whenever the (proxied) sheet mutates.
  const layout: Layout = $derived(layoutSheet(sheet));

  // View transform.
  let scale = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  const MIN_SCALE = 0.15, MAX_SCALE = 4;

  // Interaction state.
  let selection = $state<string[]>([]); // multi-select (primary = last)
  let selectedDeco = $state<{ type: "rel" | "boundary" | "summary"; id: string } | null>(null);
  let relMode = $state(false);
  let relSourceId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let editValue = $state("");
  let laserPoints = $state<{ x: number; y: number; id: number }[]>([]);
  let nowTime = $state(Date.now());
  let panning = $state(false);
  let editInput = $state<HTMLTextAreaElement | null>(null);
  let svgEl = $state<SVGSVGElement | null>(null);
  let canvasEl = $state<HTMLDivElement | null>(null);
  let viewW = $state(0);
  let viewH = $state(0);

  // Context menu (canvas-relative pixel position + canvas point for inserts).
  let ctxMenu = $state<{ x: number; y: number; nodeId: string | null } | null>(null);
  let ctxPoint = { x: 0, y: 0 };

  // Search (Ctrl+F).
  let searchOpen = $state(false);
  let searchQ = $state("");
  let searchIdx = $state(0);
  let searchInput = $state<HTMLInputElement | null>(null);

  // Relationship editing (inline label rename + curve control-point drag).
  let editingRelId = $state<string | null>(null);
  let relEditValue = $state("");
  let relEditInput = $state<HTMLInputElement | null>(null);
  let relDragId: string | null = null;
  let relDragged = false;

  // Drag-to-reparent state.
  let dragId = $state<string | null>(null);
  let dragOverId = $state<string | null>(null);
  let dropMode = $state<"child" | "before" | "after">("child");
  let pressed = $state<{ id: string; sx: number; sy: number } | null>(null);
  let lastPoint = { x: 0, y: 0 };

  let startX = 0, startY = 0, startTx = 0, startTy = 0;

  // Gesture tracking
  const activePointers = new Map<number, { clientX: number; clientY: number }>();
  let lastDistance = 0;
  let lastMidPoint = { x: 0, y: 0 };

  function initGesture() {
    const keys = Array.from(activePointers.keys());
    if (keys.length < 2) return;
    const p1 = activePointers.get(keys[0]!)!;
    const p2 = activePointers.get(keys[1]!)!;
    lastDistance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
    lastMidPoint = {
      x: (p1.clientX + p2.clientX) / 2,
      y: (p1.clientY + p2.clientY) / 2,
    };
  }

  // Onboarding hint: shown until the first topic is selected, then it gets out
  // of the way (it otherwise overlaps the minimap/zoombar on narrow canvases).
  let showHint = $state(true);
  $effect(() => { if (selectedId) showHint = false; });

  $effect(() => {
    if (!presenterMode) {
      if (laserPoints.length) laserPoints = [];
      return;
    }
    let active = true;
    const tick = () => {
      if (!active) return;
      nowTime = Date.now();
      laserPoints = laserPoints.filter(p => nowTime - p.id < 600);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => {
      active = false;
    };
  });

  const nodeById = $derived(new Map(layout.nodes.map((n) => [n.id, n])));

  // --- helpers --------------------------------------------------------------
  function notify() { markDirty(); }

  function canvasPoint(e: PointerEvent | MouseEvent, el: HTMLElement) {
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

  // --- drag and drop images -------------------------------------------------
  function handleDragOver(e: DragEvent) {
    if (e.dataTransfer?.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer?.files.length) return;
    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith("image/")) return;
    
    const p = canvasPoint(e, e.currentTarget as HTMLElement);
    const node = nodeAt(p.x, p.y);
    if (!node) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      node.topic.image = { resource: reader.result as string };
      markDirty();
    };
    reader.readAsDataURL(file);
  }

  // --- pan & zoom -----------------------------------------------------------
  function zoomAt(factor: number, cx = viewW / 2, cy = viewH / 2) {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
    tx = cx - (cx - tx) * (next / scale);
    ty = cy - (cy - ty) * (next / scale);
    scale = next;
  }
  function zoomIn() { zoomAt(1.2); }
  function zoomOut() { zoomAt(1 / 1.2); }
  function zoomReset() { zoomAt(1 / scale); }
  function fitView() { if (viewW > 0) fit(viewW, viewH); }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.ctrlKey) {
      // Zoom (trackpad pinch-to-zoom or Ctrl + scroll wheel)
      let factor = 1 - e.deltaY * 0.002;
      factor = Math.min(1.15, Math.max(0.85, factor));
      zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
    } else {
      // Pan (trackpad two-finger scroll or standard mouse scroll wheel)
      tx -= e.deltaX;
      ty -= e.deltaY;
    }
  }

  function onBgPointerDown(e: PointerEvent) {
    // Background press → pan + clear selection.
    ctxMenu = null;
    if (e.button === 2) return; // right-click opens the context menu instead
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

  function addFloatingAt(pt: { x: number; y: number }, title = "Floating topic") {
    const t = addFloatingTopic(sheet, title, { x: pt.x - 50, y: pt.y - 17 });
    notify();
    beginEdit(t.id);
    return t;
  }

  function onCanvasDblClick(e: MouseEvent) {
    // Reaches here only for empty canvas (node/decoration dblclicks stop propagation).
    const p = canvasPoint(e, e.currentTarget as HTMLElement);
    addFloatingAt({ x: p.x - layout.shiftX, y: p.y - layout.shiftY });
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (!canvasEl) return;
    const r = canvasEl.getBoundingClientRect();
    const p = canvasPoint(e, canvasEl);
    const node = nodeAt(p.x, p.y);
    if (node && !inSelection(node.id)) selectOnly(node.id);
    ctxPoint = { x: p.x - layout.shiftX, y: p.y - layout.shiftY };
    ctxMenu = {
      x: Math.min(e.clientX - r.left, Math.max(0, viewW - 210)),
      y: Math.min(e.clientY - r.top, Math.max(0, viewH - 320)),
      nodeId: node?.id ?? null,
    };
  }

  function onContainerPointerMove(e: PointerEvent) {
    if (presenterMode) {
      const p = canvasPoint(e, e.currentTarget as HTMLElement);
      laserPoints.push({ x: p.x, y: p.y, id: Date.now() });
      if (laserPoints.length > 25) {
        laserPoints.shift();
      }
    }
    if (relDragId) {
      // Reshape the relationship curve: store the control point in layout
      // coordinates minus the normalization shift (same space as floating
      // topic positions), so it survives re-layouts.
      const p = canvasPoint(e, e.currentTarget as HTMLElement);
      const rel = (sheet.relationships ?? []).find((r) => r.id === relDragId);
      if (rel) {
        rel.controlPoints = [{ x: p.x - layout.shiftX, y: p.y - layout.shiftY }];
        relDragged = true;
      }
      return;
    }
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
    if (relDragId) {
      if (relDragged) notify();
      relDragId = null; relDragged = false;
      return;
    }
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
      if (!dragOverId) {
        // Dropped on empty canvas: detach the subtree into a floating topic —
        // but only for a real fling, not a tiny slip near where it started.
        const node = nodeById.get(dragId);
        const hasParent = !!findWithParent(sheet, dragId)?.parent;
        const farEnough = node
          ? lastPoint.x < node.x - 24 || lastPoint.x > node.x + node.w + 24 ||
            lastPoint.y < node.y - 24 || lastPoint.y > node.y + node.h + 24
          : false;
        if (hasParent && farEnough && node) {
          try {
            detachTopic(sheet, dragId, {
              x: lastPoint.x - layout.shiftX - node.w / 2,
              y: lastPoint.y - layout.shiftY - node.h / 2,
            });
            notify();
          } catch { /* central root — ignore */ }
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
    ctxMenu = null;
    if (e.button === 2) return; // handled by oncontextmenu
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
    requestAnimationFrame(() => {
      ensureVisible(id);
      editInput?.focus();
      editInput?.select();
    });
  }

  function commitEdit() {
    if (editingId) {
      const t = findTopic(sheet, editingId);
      const v = editValue.replace(/\s+$/, "");
      if (t && t.title !== v) { editText(t, v); notify(); }
    }
    editingId = null;
  }

  function cancelEdit() { editingId = null; }

  function onEditKey(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
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

  function setCollapsedRecursive(t: Topic, collapsed: boolean) {
    t.collapsed = collapsed;
    for (const c of t.children ?? []) {
      setCollapsedRecursive(c, collapsed);
    }
  }

  function expandSelectedSubtree(recursive: boolean) {
    if (selectedId) {
      const t = findTopic(sheet, selectedId);
      if (t) {
        if (recursive) {
          setCollapsedRecursive(t, false);
        } else {
          t.collapsed = false;
        }
        notify();
      }
    } else {
      if (sheet.rootTopic) setCollapsedRecursive(sheet.rootTopic, false);
      for (const f of sheet.floatingTopics ?? []) setCollapsedRecursive(f, false);
      notify();
    }
  }

  function collapseSelectedSubtree(recursive: boolean) {
    if (selectedId) {
      const t = findTopic(sheet, selectedId);
      if (t) {
        if (recursive) {
          setCollapsedRecursive(t, true);
        } else {
          t.collapsed = true;
        }
        notify();
      }
    } else {
      if (sheet.rootTopic) setCollapsedRecursive(sheet.rootTopic, true);
      for (const f of sheet.floatingTopics ?? []) setCollapsedRecursive(f, true);
      notify();
    }
  }

  // --- clipboard (copy / cut / paste / duplicate) ---------------------------
  /** Selected ids minus any that sit inside another selected subtree. */
  function topLevelSelection(): string[] {
    const ids = selection.length ? [...selection] : selectedId ? [selectedId] : [];
    return ids.filter((id) => !ids.some((other) => other !== id && isDescendant(other, id)));
  }

  function copySelected(): boolean {
    const topics = topLevelSelection()
      .map((id) => findTopic(sheet, id))
      .filter((t): t is Topic => !!t);
    if (!topics.length) return false;
    clipboard = topics.map((t) => structuredClone($state.snapshot(t)) as Topic);
    return true;
  }

  function cutSelected() {
    if (copySelected()) deleteSelected();
  }

  /** Paste into a parent topic, or as floating topics at a canvas point. */
  function pasteClipboard(parentId?: string | null, floatAt?: { x: number; y: number }) {
    if (!clipboard.length) return;
    let lastId: string | null = null;
    if (parentId) {
      const parent = findTopic(sheet, parentId);
      if (!parent) return;
      if (parent.collapsed) toggleCollapse(parent);
      for (const t of clipboard) {
        const clone = cloneTopicWithNewIds(t);
        delete clone.position;
        (parent.children ??= []).push(clone);
        lastId = clone.id;
      }
    } else {
      const at = floatAt ?? {
        x: (viewW / 2 - tx) / scale - layout.shiftX,
        y: (viewH / 2 - ty) / scale - layout.shiftY,
      };
      clipboard.forEach((t, i) => {
        const clone = cloneTopicWithNewIds(t);
        clone.position = { x: at.x + i * 24, y: at.y + i * 24 };
        (sheet.floatingTopics ??= []).push(clone);
        lastId = clone.id;
      });
    }
    notify();
    if (lastId) selectOnly(lastId);
  }

  function pasteIntoSelected() {
    pasteClipboard(selectedId ?? null);
  }

  function duplicateSelected() {
    let lastId: string | null = null;
    for (const id of topLevelSelection()) {
      const fp = findWithParent(sheet, id);
      if (!fp) continue;
      const clone = cloneTopicWithNewIds(structuredClone($state.snapshot(fp.topic)) as Topic);
      if (fp.parent) {
        delete clone.position;
        const sibs = fp.parent.children!;
        const idx = sibs.findIndex((c) => c.id === id);
        sibs.splice(idx + 1, 0, clone);
      } else if (isFloatingRoot(id)) {
        clone.position = { x: (fp.topic.position?.x ?? 0) + 24, y: (fp.topic.position?.y ?? 0) + 24 };
        (sheet.floatingTopics ??= []).push(clone);
      } else {
        continue; // the central root can't be duplicated in place
      }
      lastId = clone.id;
    }
    if (lastId) { notify(); selectOnly(lastId); }
  }

  // --- search ----------------------------------------------------------------
  const searchMatches = $derived.by(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [] as Topic[];
    const out: Topic[] = [];
    for (const t of walkSheetTopics(sheet)) {
      if (t.title.toLowerCase().includes(q)) out.push(t);
    }
    return out;
  });

  function openSearch() {
    searchOpen = true;
    requestAnimationFrame(() => { searchInput?.focus(); searchInput?.select(); });
  }
  function closeSearch() { searchOpen = false; }

  function expandAncestors(id: string) {
    let cur = findWithParent(sheet, id);
    let changed = false;
    while (cur?.parent) {
      if (cur.parent.collapsed) { cur.parent.collapsed = false; changed = true; }
      cur = findWithParent(sheet, cur.parent.id);
    }
    if (changed) notify();
  }

  function gotoMatch(i: number) {
    const m = searchMatches;
    if (!m.length) return;
    const idx = ((i % m.length) + m.length) % m.length;
    searchIdx = idx;
    const t = m[idx]!;
    expandAncestors(t.id);
    selectOnly(t.id);
    centerOn(t.id);
  }

  function onSearchKey(e: KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); gotoMatch(e.shiftKey ? searchIdx - 1 : searchIdx + 1); }
    else if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
  }

  // As the query changes, jump to the first match and keep the counter in
  // range (otherwise a shrinking result set could show a stale "5/2").
  $effect(() => {
    searchQ; // track edits to the query
    if (!searchOpen) return;
    searchIdx = 0;
    if (searchMatches.length) gotoMatch(0);
  });

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
      if (first && !findTopic(sheet, selectedId)?.collapsed) selectedId = first.id;
    } else if (key === goOutward) {
      if (fp?.parent) selectedId = fp.parent.id;
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      let sibs = fp?.parent?.children ?? (node.side !== "root" ? sheet.rootTopic.children : []);
      if (!sibs) return;
      // In balanced maps the root's children split into two sides; keep
      // vertical navigation on the same visual side instead of jumping across.
      if (fp?.parent?.id === sheet.rootTopic.id) {
        sibs = sibs.filter((c) => nodeById.get(c.id)?.side === node.side);
      }
      const idx = sibs.findIndex((c) => c.id === selectedId);
      const nextIdx = key === "ArrowUp" ? idx - 1 : idx + 1;
      if (idx !== -1 && sibs[nextIdx]) selectedId = sibs[nextIdx]!.id;
    }
    if (selectedId) { selection = [selectedId]; ensureVisible(selectedId); }
  }

  /** Nudge the view so the node stays inside the viewport (with a margin). */
  function ensureVisible(id: string) {
    const n = nodeById.get(id);
    if (!n || viewW === 0) return;
    const pad = 48;
    const l = n.x * scale + tx, t = n.y * scale + ty;
    const r = l + n.w * scale, b = t + n.h * scale;
    if (l < pad) tx += pad - l;
    else if (r > viewW - pad) tx -= r - (viewW - pad);
    if (t < pad) ty += pad - t;
    else if (b > viewH - pad) ty -= b - (viewH - pad);
  }

  /** Center the view on a topic (used by search and external callers). */
  export function centerOn(id: string) {
    const n = layout.nodes.find((x) => x.id === id);
    if (!n || viewW === 0) return;
    
    if (presenterMode) {
      // Collect visible descendants
      const getSubtreeNodes = (topic: Topic): LaidOutNode[] => {
        const subNodes: LaidOutNode[] = [];
        const node = layout.nodes.find(x => x.id === topic.id);
        if (node) subNodes.push(node);
        
        if (!topic.collapsed && topic.children) {
          for (const child of topic.children) {
            subNodes.push(...getSubtreeNodes(child));
          }
        }
        return subNodes;
      };
      
      const subNodes = getSubtreeNodes(n.topic);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const sn of subNodes) {
        if (sn.x < minX) minX = sn.x;
        if (sn.x + sn.w > maxX) maxX = sn.x + sn.w;
        if (sn.y < minY) minY = sn.y;
        if (sn.y + sn.h > maxY) maxY = sn.y + sn.h;
      }
      
      const w = maxX - minX;
      const h = maxY - minY;
      
      // Target 70% viewport framing
      const idealScale = Math.min((viewW * 0.7) / w, (viewH * 0.7) / h);
      scale = Math.min(Math.max(idealScale, 0.65), 1.25);
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      tx = viewW / 2 - centerX * scale;
      ty = viewH / 2 - centerY * scale;
    } else {
      tx = viewW / 2 - (n.x + n.w / 2) * scale;
      ty = viewH / 2 - (n.y + n.h / 2) * scale;
    }
  }

  // --- global keyboard ------------------------------------------------------
  $effect(() => {
    function onKey(e: KeyboardEvent) {
      if (editingId) return; // the edit textarea owns keys while editing
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault(); openSearch(); return;
      }
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey) {
        const k = e.key;
        if (k === "=" || k === "+") { e.preventDefault(); zoomIn(); }
        else if (k === "-") { e.preventDefault(); zoomOut(); }
        else if (k === "0") { e.preventDefault(); zoomReset(); }
        else if (k.toLowerCase() === "c") { e.preventDefault(); copySelected(); }
        else if (k.toLowerCase() === "x") { e.preventDefault(); cutSelected(); }
        else if (k.toLowerCase() === "v") { e.preventDefault(); pasteIntoSelected(); }
        else if (k.toLowerCase() === "d") { e.preventDefault(); duplicateSelected(); }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        if (ctxMenu) { ctxMenu = null; return; }
        if (dragId || pressed) { dragId = null; dragOverId = null; pressed = null; return; }
        relMode = false; relSourceId = null; clearSelection();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault(); deleteSelected(); return;
      }
      if (e.key === "*") {
        e.preventDefault(); expandSelectedSubtree(true); return;
      }
      if (e.key === "/") {
        e.preventDefault(); collapseSelectedSubtree(true); return;
      }
      if (!selectedId) return;
      switch (e.key) {
        case "Tab": e.preventDefault(); addChildToSelected(); break;
        case "Insert": e.preventDefault(); addChildToSelected(); break;
        case "Enter": e.preventDefault(); addSiblingToSelected(); break;
        case "F2": e.preventDefault(); beginEdit(selectedId); break;
        case " ": e.preventDefault(); collapseSelected(); break;
        case "+":
        case "=": e.preventDefault(); expandSelectedSubtree(false); break;
        case "-": e.preventDefault(); collapseSelectedSubtree(false); break;
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

  // Multi-touch gestures for zoom and pan on touchscreen.
  $effect(() => {
    if (!canvasEl) return;
    const el = canvasEl;

    const onDown = (e: PointerEvent) => {
      activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      if (activePointers.size >= 2) {
        panning = false;
        dragId = null;
        dragOverId = null;
        pressed = null;
        relDragId = null;
        relDragged = false;
        ctxMenu = null;
        initGesture();
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        el.setPointerCapture(e.pointerId);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
      }
      if (activePointers.size >= 2) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const keys = Array.from(activePointers.keys());
        const p1 = activePointers.get(keys[0]!)!;
        const p2 = activePointers.get(keys[1]!)!;

        const currentDistance = Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY);
        const currentMidPoint = {
          x: (p1.clientX + p2.clientX) / 2,
          y: (p1.clientY + p2.clientY) / 2,
        };

        if (lastDistance > 0 && currentDistance > 0) {
          const factor = currentDistance / lastDistance;
          const rect = el.getBoundingClientRect();
          zoomAt(factor, currentMidPoint.x - rect.left, currentMidPoint.y - rect.top);
        }

        tx += (currentMidPoint.x - lastMidPoint.x);
        ty += (currentMidPoint.y - lastMidPoint.y);

        lastDistance = currentDistance;
        lastMidPoint = currentMidPoint;
      }
    };

    const onUp = (e: PointerEvent) => {
      if (activePointers.has(e.pointerId)) {
        activePointers.delete(e.pointerId);
        if (activePointers.size >= 2) {
          initGesture();
        } else {
          lastDistance = 0;
        }
      }
    };

    const onBlur = () => {
      activePointers.clear();
      lastDistance = 0;
    };

    el.addEventListener("pointerdown", onDown, { capture: true });
    el.addEventListener("pointermove", onMove, { capture: true });
    window.addEventListener("pointerup", onUp, { capture: true });
    window.addEventListener("pointercancel", onUp, { capture: true });
    window.addEventListener("blur", onBlur);

    return () => {
      activePointers.clear();
      el.removeEventListener("pointerdown", onDown, { capture: true });
      el.removeEventListener("pointermove", onMove, { capture: true });
      window.removeEventListener("pointerup", onUp, { capture: true });
      window.removeEventListener("pointercancel", onUp, { capture: true });
      window.removeEventListener("blur", onBlur);
    };
  });

  const MM_W = 190, MM_H = 130;
  const mini = $derived.by(() => {
    const s = Math.min(MM_W / Math.max(1, layout.width), MM_H / Math.max(1, layout.height));
    return { s, w: layout.width * s, h: layout.height * s };
  });
  let miniDragging = false;
  function miniMoveTo(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const lx = (e.clientX - r.left) / mini.s;
    const ly = (e.clientY - r.top) / mini.s;
    tx = viewW / 2 - lx * scale;
    ty = viewH / 2 - ly * scale;
  }
  function onMinimapDown(e: PointerEvent) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    miniDragging = true;
    miniMoveTo(e);
  }
  function onMinimapMove(e: PointerEvent) { if (miniDragging) miniMoveTo(e); }
  function onMinimapUp() { miniDragging = false; }

  // --- public ---------------------------------------------------------------
  export function fit(vw: number, vh: number) {
    const s = Math.min(vw / layout.width, vh / layout.height, 1.5);
    scale = s;
    tx = (vw - layout.width * s) / 2;
    ty = (vh - layout.height * s) / 2;
  }

  const EXPORT_FONT = "Inter, 'Segoe UI', system-ui, -apple-system, sans-serif";

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
    // The live SVG inherits its font from the page CSS; a serialized SVG does
    // not, so pin the family explicitly or the export falls back to serif.
    clone.setAttribute("font-family", EXPORT_FONT);
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

  /**
   * Small PNG preview of the sheet for the .vmm's thumbnails/ entry
   * (DESIGN.md §4.1). Returns null when rendering fails — thumbnails are
   * best-effort and must never block a save.
   */
  export async function thumbnail(maxW = 320): Promise<Uint8Array | null> {
    try {
      const r = await renderCanvas();
      if (!r) return null;
      const s = Math.min(1, maxW / r.canvas.width);
      const tw = Math.max(1, Math.round(r.canvas.width * s));
      const th = Math.max(1, Math.round(r.canvas.height * s));
      const small = document.createElement("canvas");
      small.width = tw; small.height = th;
      small.getContext("2d")!.drawImage(r.canvas, 0, 0, tw, th);
      const blob = await new Promise<Blob | null>((res) => small.toBlob(res, "image/png"));
      if (!blob) return null;
      return new Uint8Array(await blob.arrayBuffer());
    } catch {
      return null;
    }
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

  // Canvas chrome (dot grid, table separators) adapts to the sheet background
  // so a dark-themed sheet doesn't show jarring near-white dots/lines.
  const canvasBg = $derived(sheet.background?.color ?? "#f5f6f8");
  const darkCanvas = $derived(isDark(canvasBg));
  const dotColor = $derived(darkCanvas ? "rgba(255,255,255,0.07)" : "rgba(20,28,45,0.07)");
  const gridStroke = $derived(darkCanvas ? "#3a4152" : "#cbd2dc");
  function rxFor(n: LaidOutNode): number {
    const shape = n.topic.style?.shape ?? "rounded";
    if (shape === "rect") return 0;
    if (shape === "capsule") return n.h / 2;
    return 8;
  }
  const MARKER_ICONS: Record<string, string> = {
    "flag-red": "🚩", "flag-green": "🏁", "flag-blue": "🗳️", star: "⭐", "star-yellow": "⭐", "star-blue": "🌟",
    "task-done": "✅", "task-start": "🔵", "task-25%": "◔", "task-50%": "◑", "task-75%": "◕",
    idea: "💡", question: "❓", people: "👤", smiley: "🙂", heart: "❤️", warning: "⚠️", info: "ℹ️",
    cross: "❌", check: "✔️", rocket: "🚀", fire: "🔥", bomb: "💣", money: "💰", calendar: "📅",
    clock: "⏰", "chart-up": "📈", "chart-down": "📉", pin: "📌", key: "🔑", lock: "🔒",
    wink: "😉", "thumb-up": "👍", "thumb-down": "👎",
  };
  const PRIORITY_COLORS: Record<string, string> = {
    "1": "#e5484d", "2": "#e98a3a", "3": "#3f7fd0", "4": "#3aa6a6", "5": "#4fa84f",
    "6": "#e7b93f", "7": "#7a5cc9", "8": "#c95ca0", "9": "#64748b",
  };
  function markerIcon(id: string): string {
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
  // A user-dragged control point (rel.controlPoints[0], stored shift-free)
  // overrides the default perpendicular bow.
  const relationships = $derived.by(() => {
    const out: { id: string; d: string; lx: number; ly: number; title?: string }[] = [];
    for (const rel of sheet.relationships ?? []) {
      const a = nodeById.get(rel.end1Id);
      const b = nodeById.get(rel.end2Id);
      if (!a || !b) continue;
      const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
      const bx = b.x + b.w / 2, by = b.y + b.h / 2;
      let cx: number, cy: number;
      const cp = rel.controlPoints?.[0];
      if (cp) {
        cx = cp.x + layout.shiftX;
        cy = cp.y + layout.shiftY;
      } else {
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const dx = bx - ax, dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        const off = 44;
        cx = mx + (-dy / len) * off;
        cy = my + (dx / len) * off;
      }
      out.push({ id: rel.id, d: `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`, lx: cx, ly: cy, title: rel.title });
    }
    return out;
  });

  // --- relationship label editing -------------------------------------------
  function beginRelEdit(id: string) {
    const rel = (sheet.relationships ?? []).find((r) => r.id === id);
    if (!rel) return;
    relEditValue = rel.title ?? "";
    editingRelId = id;
    requestAnimationFrame(() => { relEditInput?.focus(); relEditInput?.select(); });
  }
  function commitRelEdit() {
    if (editingRelId) {
      const rel = (sheet.relationships ?? []).find((r) => r.id === editingRelId);
      const v = relEditValue.trim();
      if (rel && (rel.title ?? "") !== v) {
        rel.title = v || undefined;
        notify();
      }
    }
    editingRelId = null;
  }
  function onRelEditKey(e: KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commitRelEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); editingRelId = null; }
  }

  // Screen-space geometry for the relationship label editor.
  const relEditBox = $derived.by(() => {
    if (!editingRelId) return null;
    const r = relationships.find((x) => x.id === editingRelId);
    if (!r) return null;
    return { left: r.lx * scale + tx - 70, top: r.ly * scale + ty - 14 };
  });

  // Geometry for the inline edit overlay (screen coordinates).
  const editBox = $derived.by(() => {
    if (!editingId) return null;
    const n = nodeById.get(editingId);
    if (!n) return null;
    return { left: n.x * scale + tx, top: n.y * scale + ty, w: n.w * scale, h: n.h * scale };
  });

  const ctxTopic = $derived(ctxMenu?.nodeId ? findTopic(sheet, ctxMenu.nodeId) ?? null : null);
</script>

<div
  bind:this={canvasEl}
  class="canvas"
  role="application"
  style={`background-color:${canvasBg}; background-image: radial-gradient(circle, ${dotColor} 1px, transparent 1px); background-size: 24px 24px;`}
  ondblclick={onCanvasDblClick}
  oncontextmenu={onContextMenu}
  onwheel={onWheel}
  onpointerdown={onBgPointerDown}
  onpointermove={onContainerPointerMove}
  onpointerup={onContainerPointerUp}
  onpointercancel={onContainerPointerUp}
  ondragover={handleDragOver}
  ondrop={handleDrop}
  class:panning
  class:dragging={dragId !== null}
>
  <svg bind:this={svgEl} width="100%" height="100%">
    <defs>
      <marker id="rel-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
      </marker>
      <filter id="laser-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <g class:animate-viewport={presenterMode && !panning && dragId === null} transform={`translate(${tx} ${ty}) scale(${scale})`}>
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
        <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={gridStroke} stroke-width="1" />
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
          onpointerdown={(e) => { e.stopPropagation(); selectDeco("rel", r.id); }}
          ondblclick={(e) => { e.stopPropagation(); beginRelEdit(r.id); }} />
        <path d={r.d} fill="none"
          stroke={selectedDeco?.id === r.id ? "#1d4ed8" : "#94a3b8"}
          stroke-width={selectedDeco?.id === r.id ? 3 : 2}
          stroke-dasharray="6 4" marker-end="url(#rel-arrow)" pointer-events="none" />
        {#if r.title && r.id !== editingRelId}
          <text x={r.lx} y={r.ly} font-size="11" text-anchor="middle"
            dominant-baseline="central" fill="#64748b" pointer-events="none">{r.title}</text>
        {/if}
        {#if selectedDeco?.type === "rel" && selectedDeco.id === r.id}
          <!-- Drag this handle to reshape the curve. -->
          <circle cx={r.lx} cy={r.ly} r={7 / scale} fill="#1d4ed8" fill-opacity="0.25"
            stroke="#1d4ed8" stroke-width={1.5 / scale} style="cursor:move"
            role="button" tabindex={-1} aria-label="Reshape relationship"
            onpointerdown={(e) => { e.stopPropagation(); relDragId = r.id; relDragged = false; }} />
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
          class:presenting-highlight={presenterMode}
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

          {#if n.id !== editingId}
            <text
              dominant-baseline="central" text-anchor="middle"
              font-family={n.topic.style?.font?.family ?? "inherit"}
              font-size={n.topic.style?.font?.size ?? (n.depth === 0 ? 15 : 13)}
              font-weight={n.topic.style?.font?.weight ?? (n.depth === 0 ? "700" : n.depth === 1 ? "600" : "400")}
              font-style={n.topic.style?.font?.style ?? "normal"}
              text-decoration={n.topic.style?.font?.decoration ?? "none"}
              fill={textFill(n)}
            >
              {#each n.lines as line, li (li)}
                <tspan x={n.w / 2} y={n.h / 2 + (li - (n.lines.length - 1) / 2) * n.lineH}>{line}</tspan>
              {/each}
            </text>
          {/if}

          {#if n.topic.image && imgUrl(n.topic.image.resource)}
            {@const sz = imgSize(n)}
            <image href={imgUrl(n.topic.image.resource)} x={(n.w - sz.w) / 2}
              y={-(sz.h + 6)} width={sz.w} height={sz.h} preserveAspectRatio="xMidYMid meet" />
          {/if}

          {#if n.topic.markers?.length}
            <g transform={`translate(6 -8)`}>
              {#each n.topic.markers as mk, mi (mk)}
                {#if mk.startsWith("priority-")}
                  {@const p = mk.slice("priority-".length)}
                  <g transform={`translate(${mi * 19} 0)`}>
                    <circle r="8" fill={PRIORITY_COLORS[p] ?? "#64748b"} />
                    <text dominant-baseline="central" text-anchor="middle" font-size="10.5"
                      font-weight="700" fill="#fff">{p}</text>
                  </g>
                {:else}
                  <text x={mi * 19} dominant-baseline="central" text-anchor="middle" font-size="13">{markerIcon(mk)}</text>
                {/if}
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
      {#if presenterMode && laserPoints.length > 0}
        <g pointer-events="none">
          {#each laserPoints as p, i (p.id)}
            {@const age = (nowTime - p.id) / 600}
            {@const opacity = Math.max(0, 1 - age)}
            {@const size = Math.max(0, 6 * (1 - age))}
            {#if opacity > 0 && size > 0}
              <circle cx={p.x} cy={p.y} r={size} fill="#f38ba8" opacity={opacity} filter="url(#laser-glow)" />
            {/if}
          {/each}
        </g>
      {/if}
    </g>
  </svg>

  {#if relEditBox}
    <input
      class="rel-edit"
      bind:this={relEditInput}
      bind:value={relEditValue}
      placeholder="Label…"
      style={`left:${relEditBox.left}px; top:${relEditBox.top}px;`}
      onkeydown={onRelEditKey}
      onblur={commitRelEdit}
      onpointerdown={(e) => e.stopPropagation()}
    />
  {/if}

  {#if editBox}
    <textarea
      class="edit"
      bind:this={editInput}
      bind:value={editValue}
      rows="1"
      style={`left:${editBox.left}px; top:${editBox.top}px; width:${Math.max(90, editBox.w)}px; height:${Math.max(30, editBox.h)}px; font-size:${13 * scale}px;`}
      onkeydown={onEditKey}
      onblur={commitEdit}
      onpointerdown={(e) => e.stopPropagation()}
    ></textarea>
  {/if}

  {#if ctxMenu}
    <div class="ctxmenu" role="menu" tabindex={-1}
      style={`left:${ctxMenu.x}px; top:${ctxMenu.y}px;`}
      onpointerdown={(e) => e.stopPropagation()}>
      {#if ctxMenu.nodeId}
        {@const id = ctxMenu.nodeId}
        <button role="menuitem" onclick={() => { ctxMenu = null; selectOnly(id); addChildToSelected(); }}>Add child <kbd>Tab</kbd></button>
        <button role="menuitem" onclick={() => { ctxMenu = null; selectOnly(id); addSiblingToSelected(); }}>Add sibling <kbd>Enter</kbd></button>
        <button role="menuitem" onclick={() => { ctxMenu = null; beginEdit(id); }}>Rename <kbd>F2</kbd></button>
        <button role="menuitem" onclick={() => { ctxMenu = null; selectOnly(id); startRelate(); }}>Relate →</button>
        <hr />
        <button role="menuitem" onclick={() => { ctxMenu = null; copySelected(); }}>Copy <kbd>Ctrl+C</kbd></button>
        <button role="menuitem" onclick={() => { ctxMenu = null; cutSelected(); }}>Cut <kbd>Ctrl+X</kbd></button>
        <button role="menuitem" disabled={!clipboard.length} onclick={() => { ctxMenu = null; pasteClipboard(id); }}>Paste as child <kbd>Ctrl+V</kbd></button>
        <button role="menuitem" onclick={() => { ctxMenu = null; duplicateSelected(); }}>Duplicate <kbd>Ctrl+D</kbd></button>
        <hr />
        {#if ctxTopic && hasChildren(ctxTopic)}
          <button role="menuitem" onclick={() => { ctxMenu = null; selectOnly(id); collapseSelected(); }}>
            {ctxTopic.collapsed ? "Expand" : "Collapse"} <kbd>Space</kbd>
          </button>
        {/if}
        <button role="menuitem" class="danger" onclick={() => { ctxMenu = null; selectOnly(id); deleteSelected(); }}>Delete <kbd>Del</kbd></button>
      {:else}
        <button role="menuitem" onclick={() => { const p = ctxPoint; ctxMenu = null; addFloatingAt(p); }}>New floating topic</button>
        <button role="menuitem" disabled={!clipboard.length} onclick={() => { const p = ctxPoint; ctxMenu = null; pasteClipboard(null, p); }}>Paste here</button>
        <hr />
        <button role="menuitem" onclick={() => { ctxMenu = null; fitView(); }}>Fit map to view</button>
        <button role="menuitem" onclick={() => { ctxMenu = null; zoomReset(); }}>Zoom 100%</button>
      {/if}
    </div>
  {/if}

  {#if searchOpen}
    <div class="searchbar" role="search" onpointerdown={(e) => e.stopPropagation()}>
      <input
        bind:this={searchInput}
        bind:value={searchQ}
        placeholder="Find topics…"
        onkeydown={onSearchKey}
      />
      <span class="count">{searchQ.trim() ? `${searchMatches.length ? searchIdx + 1 : 0}/${searchMatches.length}` : ""}</span>
      <button title="Previous (Shift+Enter)" disabled={!searchMatches.length} onclick={() => gotoMatch(searchIdx - 1)}>↑</button>
      <button title="Next (Enter)" disabled={!searchMatches.length} onclick={() => gotoMatch(searchIdx + 1)}>↓</button>
      <button title="Close (Esc)" onclick={closeSearch}>✕</button>
    </div>
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
      {#if selectedDeco.type === "rel"}
        <button onclick={() => beginRelEdit(selectedDeco!.id)}>Edit label</button>
      {/if}
      <button onclick={deleteSelected}>Delete</button>
    </div>
  {/if}

  <div class="zoombar" role="toolbar" tabindex={-1} onpointerdown={(e) => e.stopPropagation()}>
    <button title="Zoom out (Ctrl+-)" onclick={zoomOut}>−</button>
    <button class="pct" title="Reset to 100% (Ctrl+0)" onclick={zoomReset}>{Math.round(scale * 100)}%</button>
    <button title="Zoom in (Ctrl+=)" onclick={zoomIn}>+</button>
    <button title="Fit map to view" onclick={fitView}>⛶</button>
  </div>

  {#if layout.nodes.length > 1}
    <svg class="minimap" width={mini.w} height={mini.h} viewBox={`0 0 ${mini.w} ${mini.h}`}
      role="application" onpointerdown={onMinimapDown} onpointermove={onMinimapMove}
      onpointerup={onMinimapUp} onpointercancel={onMinimapUp}>
      <rect x="0" y="0" width={mini.w} height={mini.h} fill="var(--panel)" />
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

  {#if showHint}
    <div class="hint">
      Tab: child · Enter: sibling · F2: rename · Del: delete · Ctrl+C/V: copy/paste · Ctrl+F: find · right-click: menu
    </div>
  {/if}
</div>

<style>
  .canvas {
    position: relative;
    width: 100%; height: 100%;
    cursor: grab;
    /* background-color + dot grid are set inline so they adapt to the sheet
       background (see the derived dotColor). */
    background-position: 0 0;
    touch-action: none; user-select: none;
    overflow: hidden;
  }
  .canvas.panning { cursor: grabbing; }
  .canvas.dragging { cursor: grabbing; }
  .animate-viewport {
    transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  }
  .node { cursor: pointer; }
  .node.ghost { opacity: 0.45; }

  @keyframes pulse-glow {
    0% {
      stroke-width: 3px;
      filter: drop-shadow(0 0 2px rgba(29, 78, 216, 0.5));
    }
    50% {
      stroke-width: 4.5px;
      filter: drop-shadow(0 0 8px rgba(29, 78, 216, 0.8));
    }
    100% {
      stroke-width: 3px;
      filter: drop-shadow(0 0 2px rgba(29, 78, 216, 0.5));
    }
  }

  .node.selected.presenting-highlight rect,
  .node.selected.presenting-highlight ellipse {
    animation: pulse-glow 2s infinite ease-in-out;
    stroke: #1d4ed8 !important;
  }
  .toggle { cursor: pointer; }
  text { pointer-events: none; }
  .toggle text { pointer-events: none; }

  .edit {
    position: absolute;
    box-sizing: border-box;
    border: 2px solid #1d4ed8;
    border-radius: 8px;
    padding: 4px 8px;
    text-align: center;
    outline: none;
    background: var(--panel);
    color: var(--text);
    font-family: inherit;
    line-height: 1.35;
    resize: none;
    overflow: hidden;
  }
  .rel-edit {
    position: absolute;
    width: 140px;
    box-sizing: border-box;
    border: 2px solid #1d4ed8;
    border-radius: 8px;
    padding: 3px 8px;
    text-align: center;
    outline: none;
    background: var(--panel);
    color: var(--text);
    font: inherit;
    font-size: 12px;
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
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    padding: 6px 10px; font-size: 13px; box-shadow: var(--elev-2);
  }
  .actionbar span { color: var(--muted); }
  .actionbar button { padding: 4px 10px; font-size: 12px; }
  .actionbar.rel { background: #faf5ff; border-color: #d8b4fe; color: #6b21a8; }
  .zoombar {
    position: absolute; left: 10px; bottom: 10px;
    display: flex; align-items: center; gap: 2px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    padding: 3px; box-shadow: var(--elev-1);
  }
  .zoombar button {
    width: 30px; height: 28px; padding: 0; border: none; border-radius: 7px;
    background: transparent; color: var(--text); font-size: 15px; line-height: 1;
  }
  .zoombar button.pct { width: 48px; font-size: 12px; font-weight: 600; color: var(--muted); }
  .zoombar button:hover:not(:disabled) { background: var(--surface-2); }
  .searchbar {
    position: absolute; right: 10px; top: 10px;
    display: flex; align-items: center; gap: 4px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    padding: 5px 6px; box-shadow: var(--elev-2);
  }
  .searchbar input {
    width: 180px; border: none; outline: none; font: inherit; font-size: 13px;
    padding: 3px 6px; background: transparent; color: var(--text);
  }
  .searchbar .count { font-size: 11px; color: var(--muted); min-width: 32px; text-align: center; }
  .searchbar button {
    width: 26px; height: 26px; padding: 0; border: none; border-radius: 6px;
    background: transparent; color: var(--muted); font-size: 13px;
  }
  .searchbar button:hover:not(:disabled) { background: var(--surface-2); color: var(--text); }
  .ctxmenu {
    position: absolute; z-index: 30; min-width: 200px;
    background: var(--panel); border: 1px solid var(--border); border-radius: 10px;
    box-shadow: var(--elev-3); padding: 5px;
  }
  .ctxmenu button {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    width: 100%; border: none; border-radius: 7px; background: transparent;
    padding: 7px 10px; font-size: 13px; font-weight: 500; color: var(--text); text-align: left;
  }
  .ctxmenu button:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 10%, transparent); }
  .ctxmenu button:disabled { color: var(--muted); opacity: 0.55; }
  .ctxmenu button.danger { color: #c0392b; }
  .ctxmenu button.danger:hover:not(:disabled) { background: #fdecea; }
  .ctxmenu kbd {
    font-family: inherit; font-size: 11px; color: var(--muted);
    background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px; padding: 0 5px;
  }
  .ctxmenu hr { border: none; border-top: 1px solid var(--border); margin: 4px 6px; }
  .minimap {
    position: absolute; right: 10px; bottom: 10px;
    border: 1px solid var(--border); border-radius: 6px;
    box-shadow: var(--elev-1); background: var(--panel); cursor: pointer;
  }
</style>
