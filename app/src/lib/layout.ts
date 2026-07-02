/**
 * Layout for VynMM sheets (DESIGN.md §5.1).
 *
 * Pure geometry: a `Sheet` in → positioned boxes, edges, boundaries, summaries.
 * `layoutSheet` dispatches on the sheet's `structure` and also places floating
 * topics and the decorations (boundaries / summaries) that wrap topic groups.
 */

import type { Sheet, StructureId, Topic } from "../../../src/index.js";

export interface LaidOutNode {
  id: string;
  topic: Topic;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  side: "root" | "left" | "right" | "down" | "up";
  color: string;
  hasHiddenChildren: boolean;
  /** Title split into rendered lines (explicit \n plus word wrap). */
  lines: string[];
  /** Vertical distance between rendered lines. */
  lineH: number;
  floating?: boolean;
}

export interface LaidOutEdge {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  kind: "bezier" | "elbow-h" | "elbow-v" | "straight";
  width?: number;
}

export interface GridLine {
  x1: number; y1: number;
  x2: number; y2: number;
}

export interface BoundaryBox {
  id: string;
  x: number; y: number; w: number; h: number;
  title?: string;
  color: string;
}

export interface SummaryDeco {
  id: string;
  side: "left" | "right";
  x: number; y1: number; y2: number;
}

export interface Layout {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  boundaries: BoundaryBox[];
  summaries: SummaryDeco[];
  /** Braces grouping children (brace maps). */
  braces: SummaryDeco[];
  /** Table/grid separator lines (matrix, tree-table). */
  gridLines: GridLine[];
  width: number;
  height: number;
  /** Translation applied during normalization (canvas = local + shift). */
  shiftX: number;
  shiftY: number;
}

// Tunables -----------------------------------------------------------------
const NODE_H = 34;
const ROW_GAP = 14;
const COL_GAP = 26;
const LEVEL_GAP = 56;
const CHAR_W = 7.6;
const PAD_X = 26;
const PAD_Y = 8;
const MIN_W = 56;
const MAX_W = 260;
const MARGIN = 56;

const PALETTE = [
  "#e6584c", "#e98a3a", "#e7b93f", "#4fa84f",
  "#3aa6a6", "#3f7fd0", "#7a5cc9", "#c95ca0",
];
const ROOT_COLOR = "#33415c";
const FLOAT_COLOR = "#7a8699";
const SUMMARY_COLOR = "#64748b";

// Sizing / wrapping ----------------------------------------------------------

export interface TopicSize { w: number; h: number; lines: string[]; lineH: number }

/**
 * Measure a topic box: wraps the title (explicit newlines + greedy word wrap)
 * to at most MAX_W, and grows the box height to fit all lines.
 */
export function sizeOf(t: Topic): TopicSize {
  const size = t.style?.font?.size ?? 13;
  const cw = CHAR_W * (size / 13) * (t.style?.font?.weight === "bold" ? 1.05 : 1);
  const maxChars = Math.max(4, Math.floor((MAX_W - PAD_X) / cw));

  const lines: string[] = [];
  for (const raw of (t.title ?? "").split("\n")) {
    if (raw.length <= maxChars) { lines.push(raw); continue; }
    let cur = "";
    for (let word of raw.split(/ +/)) {
      while (word.length > maxChars) {
        // A single over-long word: flush and hard-break it.
        if (cur) { lines.push(cur); cur = ""; }
        lines.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
      }
      if (!cur) cur = word;
      else if (cur.length + 1 + word.length <= maxChars) cur += " " + word;
      else { lines.push(cur); cur = word; }
    }
    lines.push(cur);
  }
  if (!lines.length) lines.push("");

  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const lineH = Math.max(18, size + 5);
  const w = Math.max(MIN_W, Math.min(MAX_W, longest * cw + PAD_X));
  const h = Math.max(NODE_H, lines.length * lineH + PAD_Y * 2);
  return { w, h, lines, lineH };
}

/** Back-compat width-only measure. */
export function widthOf(t: Topic): number {
  return sizeOf(t).w;
}

function mkNode(
  t: Topic, x: number, y: number, s: TopicSize, depth: number,
  side: LaidOutNode["side"], color: string,
): LaidOutNode {
  return {
    id: t.id, topic: t, x, y, w: s.w, h: s.h, depth, side, color,
    hasHiddenChildren: hidden(t), lines: s.lines, lineH: s.lineH,
  };
}

function visibleChildren(t: Topic): Topic[] {
  return t.collapsed ? [] : t.children ?? [];
}
function hidden(t: Topic): boolean {
  return t.collapsed === true && (t.children?.length ?? 0) > 0;
}

interface Cursor { v: number; }

function placeH(
  t: Topic, depth: number, side: "left" | "right", dir: 1 | -1,
  nearX: number, color: string, cursor: Cursor, nodes: LaidOutNode[],
): number {
  const s = sizeOf(t);
  const boxLeft = dir > 0 ? nearX : nearX - s.w;
  const farX = dir > 0 ? nearX + s.w : nearX - s.w;
  const kids = visibleChildren(t);
  let cy: number;
  if (kids.length === 0) {
    cy = cursor.v + s.h / 2;
    cursor.v += s.h + ROW_GAP;
  } else {
    const childNearX = farX + dir * LEVEL_GAP;
    const cys = kids.map((k) => placeH(k, depth + 1, side, dir, childNearX, color, cursor, nodes));
    cy = (cys[0]! + cys[cys.length - 1]!) / 2;
    // A parent taller than its children's span must still claim its own room.
    cursor.v = Math.max(cursor.v, cy + s.h / 2 + ROW_GAP);
  }
  nodes.push(mkNode(t, boxLeft, cy - s.h / 2, s, depth, side, color));
  return cy;
}

function placeV(
  t: Topic, depth: number, side: "down" | "up", dir: 1 | -1,
  nearY: number, color: string, cursor: Cursor, nodes: LaidOutNode[],
): number {
  const s = sizeOf(t);
  const boxTop = dir > 0 ? nearY : nearY - s.h;
  const farY = dir > 0 ? nearY + s.h : nearY - s.h;
  const kids = visibleChildren(t);
  let cx: number;
  if (kids.length === 0) {
    cx = cursor.v + s.w / 2;
    cursor.v += s.w + COL_GAP;
  } else {
    const childNearY = farY + dir * LEVEL_GAP;
    const cxs = kids.map((k) => placeV(k, depth + 1, side, dir, childNearY, color, cursor, nodes));
    cx = (cxs[0]! + cxs[cxs.length - 1]!) / 2;
    cursor.v = Math.max(cursor.v, cx + s.w / 2 + COL_GAP);
  }
  nodes.push(mkNode(t, cx - s.w / 2, boxTop, s, depth, side, color));
  return cx;
}

function shiftRange(nodes: LaidOutNode[], from: number, dx: number, dy: number): void {
  for (let i = from; i < nodes.length; i++) { nodes[i]!.x += dx; nodes[i]!.y += dy; }
}

const colorFor = (i: number) => PALETTE[i % PALETTE.length]!;

function horizontal(sheet: Sheet, mode: "balanced" | "right" | "left"): LaidOutNode[] {
  const nodes: LaidOutNode[] = [];
  const root = sheet.rootTopic;
  const rootS = sizeOf(root);
  const kids = visibleChildren(root);

  const right: { t: Topic; i: number }[] = [];
  const left: { t: Topic; i: number }[] = [];
  kids.forEach((t, i) => {
    if (mode === "left") left.push({ t, i });
    else if (mode === "right") right.push({ t, i });
    else (i % 2 === 0 ? right : left).push({ t, i });
  });

  const rStart = nodes.length;
  const rc: Cursor = { v: 0 };
  for (const { t, i } of right) placeH(t, 1, "right", 1, rootS.w / 2 + LEVEL_GAP, colorFor(i), rc, nodes);
  shiftRange(nodes, rStart, 0, -Math.max(0, rc.v - ROW_GAP) / 2);

  const lStart = nodes.length;
  const lc: Cursor = { v: 0 };
  for (const { t, i } of left) placeH(t, 1, "left", -1, -rootS.w / 2 - LEVEL_GAP, colorFor(i), lc, nodes);
  shiftRange(nodes, lStart, 0, -Math.max(0, lc.v - ROW_GAP) / 2);

  nodes.push(mkNode(root, -rootS.w / 2, -rootS.h / 2, rootS, 0, "root", ROOT_COLOR));
  return nodes;
}

function vertical(sheet: Sheet, dir: "down" | "up"): LaidOutNode[] {
  const nodes: LaidOutNode[] = [];
  const root = sheet.rootTopic;
  const rootS = sizeOf(root);
  const d: 1 | -1 = dir === "down" ? 1 : -1;
  const kids = visibleChildren(root);

  const start = nodes.length;
  const c: Cursor = { v: 0 };
  kids.forEach((t, i) => placeV(t, 1, dir, d, (d > 0 ? rootS.h / 2 : -rootS.h / 2) + d * LEVEL_GAP, colorFor(i), c, nodes));
  shiftRange(nodes, start, -Math.max(0, c.v - COL_GAP) / 2, 0);

  nodes.push(mkNode(root, -rootS.w / 2, -rootS.h / 2, rootS, 0, "root", ROOT_COLOR));
  return nodes;
}

/** Place a floating topic's subtree, anchored at its stored position. */
function placeFloating(topic: Topic, index: number, nodes: LaidOutNode[]): void {
  const sub: LaidOutNode[] = [];
  placeH(topic, 1, "right", 1, 0, FLOAT_COLOR, { v: 0 }, sub);
  const root = sub.find((n) => n.id === topic.id)!;
  const px = topic.position?.x ?? 360;
  const py = topic.position?.y ?? -160 + index * 90;
  const dx = px - root.x;
  const dy = py - root.y;
  for (const n of sub) { n.x += dx; n.y += dy; n.floating = true; }
  nodes.push(...sub);
}

function buildEdges(nodes: LaidOutNode[], kind: LaidOutEdge["kind"]): LaidOutEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: LaidOutEdge[] = [];
  for (const n of nodes) {
    for (const child of visibleChildren(n.topic)) {
      const cn = byId.get(child.id);
      if (!cn) continue;
      const color = cn.topic.style?.lineColor ?? cn.color;
      const width = cn.topic.style?.lineWidth ?? 2.5;
      if (n.side === "down" || n.side === "up" || cn.side === "down" || cn.side === "up") {
        const down = cn.y >= n.y;
        edges.push({ id: `${n.id}->${cn.id}`, x1: n.x + n.w / 2, y1: down ? n.y + n.h : n.y, x2: cn.x + cn.w / 2, y2: down ? cn.y : cn.y + cn.h, color, kind: "elbow-v", width });
      } else {
        const right = cn.x >= n.x;
        edges.push({ id: `${n.id}->${cn.id}`, x1: right ? n.x + n.w : n.x, y1: n.y + n.h / 2, x2: right ? cn.x : cn.x + cn.w, y2: cn.y + cn.h / 2, color, kind, width });
      }
    }
  }
  return edges;
}

function subtreeNodeIds(topic: Topic): string[] {
  const ids: string[] = [];
  const walk = (t: Topic) => { ids.push(t.id); for (const c of visibleChildren(t)) walk(c); };
  walk(topic);
  return ids;
}

interface BBox { minX: number; minY: number; maxX: number; maxY: number; }
function bboxOf(ns: LaidOutNode[]): BBox | null {
  if (!ns.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of ns) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
  }
  return { minX, minY, maxX, maxY };
}

function normalize(layout: Layout): Layout {
  const { nodes, edges, boundaries, summaries, braces, gridLines } = layout;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
  }
  for (const b of boundaries) {
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
  }
  for (const e of edges) {
    minX = Math.min(minX, e.x1, e.x2); minY = Math.min(minY, e.y1, e.y2);
    maxX = Math.max(maxX, e.x1, e.x2); maxY = Math.max(maxY, e.y1, e.y2);
  }
  const dx = MARGIN - minX, dy = MARGIN - minY;
  for (const n of nodes) { n.x += dx; n.y += dy; }
  for (const e of edges) { e.x1 += dx; e.y1 += dy; e.x2 += dx; e.y2 += dy; }
  for (const b of boundaries) { b.x += dx; b.y += dy; }
  for (const s of summaries) { s.x += dx; s.y1 += dy; s.y2 += dy; }
  for (const s of braces) { s.x += dx; s.y1 += dy; s.y2 += dy; }
  for (const l of gridLines) { l.x1 += dx; l.y1 += dy; l.x2 += dx; l.y2 += dy; }
  layout.width = maxX - minX + MARGIN * 2;
  layout.height = maxY - minY + MARGIN * 2;
  layout.shiftX = dx;
  layout.shiftY = dy;
  return layout;
}

// --- brace map: horizontal tree, children grouped by braces instead of lines ---
function braceMap(sheet: Sheet, side: "left" | "right"): { nodes: LaidOutNode[]; braces: SummaryDeco[] } {
  const nodes = horizontal(sheet, side);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const braces: SummaryDeco[] = [];
  for (const n of nodes) {
    const kids = visibleChildren(n.topic).map((c) => byId.get(c.id)!).filter(Boolean);
    if (!kids.length) continue;
    const y1 = Math.min(...kids.map((k) => k.y));
    const y2 = Math.max(...kids.map((k) => k.y + k.h));
    const farX = side === "right" ? n.x + n.w : n.x;
    const childNear = side === "right" ? Math.min(...kids.map((k) => k.x)) : Math.max(...kids.map((k) => k.x + k.w));
    braces.push({ id: "brace-" + n.id, side, x: (farX + childNear) / 2, y1, y2 });
  }
  return { nodes, braces };
}

// --- fishbone / Ishikawa: spine + alternating diagonal bones --------------
function fishbone(sheet: Sheet, dir: "left" | "right"): { nodes: LaidOutNode[]; edges: LaidOutEdge[] } {
  const nodes: LaidOutNode[] = [];
  const edges: LaidOutEdge[] = [];
  const root = sheet.rootTopic;
  const rootS = sizeOf(root);
  const sgn = dir === "right" ? 1 : -1;
  nodes.push(mkNode(root, -rootS.w / 2, -rootS.h / 2, rootS, 0, "root", ROOT_COLOR));

  const bones = visibleChildren(root);
  const pairs = Math.max(1, Math.ceil(bones.length / 2));
  const spineLen = Math.max(260, pairs * 170);
  const headX = sgn > 0 ? -rootS.w / 2 : rootS.w / 2;
  const tailX = headX - sgn * spineLen;
  edges.push({ id: "spine", x1: headX, y1: 0, x2: tailX, y2: 0, color: "#64748b", kind: "straight", width: 3 });

  const boneDX = 48, boneDY = 104;
  bones.forEach((b, i) => {
    const above = i % 2 === 0;
    const slot = Math.floor(i / 2) + 1;
    const attachX = headX - sgn * spineLen * (slot / (pairs + 1));
    const color = colorFor(i);
    const bs = sizeOf(b);
    const cyB = above ? -boneDY : boneDY;
    const cxB = attachX - sgn * boneDX;
    nodes.push(mkNode(b, cxB - bs.w / 2, cyB - bs.h / 2, bs, 1, "right", color));
    edges.push({ id: `bone-${b.id}`, x1: attachX, y1: 0, x2: cxB, y2: cyB + (above ? bs.h / 2 : -bs.h / 2), color, kind: "straight", width: 2 });
    let edgeY = cyB + (above ? -bs.h / 2 : bs.h / 2);
    for (const c of visibleChildren(b)) {
      const cs = sizeOf(c);
      const cyC = above ? edgeY - 12 - cs.h / 2 : edgeY + 12 + cs.h / 2;
      edgeY = above ? cyC - cs.h / 2 : cyC + cs.h / 2;
      const cxC = cxB - sgn * 26;
      nodes.push(mkNode(c, cxC - cs.w / 2, cyC - cs.h / 2, cs, 2, "right", color));
      edges.push({ id: `fb-${c.id}`, x1: cxB, y1: cyB, x2: cxC, y2: cyC, color, kind: "straight", width: 1.5 });
    }
  });
  return { nodes, edges };
}

// --- matrix: columns of cells under level-1 headers ------------------------
function matrix(sheet: Sheet): { nodes: LaidOutNode[]; gridLines: GridLine[] } {
  const nodes: LaidOutNode[] = [];
  const lines: GridLine[] = [];
  const root = sheet.rootTopic;
  const cols = visibleChildren(root);
  const gap = 12;
  const rootS = sizeOf(root);
  nodes.push(mkNode(root, 0, 0, rootS, 0, "down", ROOT_COLOR));
  const headerY = rootS.h + 20;

  // Measure every cell first so each row can size to its tallest member.
  const colData = cols.map((c) => ({
    topic: c, header: sizeOf(c), cells: visibleChildren(c).map((g) => ({ topic: g, size: sizeOf(g) })),
  }));
  const maxRows = Math.max(0, ...colData.map((c) => c.cells.length));
  const headerH = Math.max(NODE_H, ...colData.map((c) => c.header.h));
  const rowHs: number[] = [];
  for (let r = 0; r < maxRows; r++) {
    rowHs.push(Math.max(NODE_H, ...colData.map((c) => c.cells[r]?.size.h ?? 0)) + 10);
  }
  const rowY = (r: number) => headerY + headerH + 10 + rowHs.slice(0, r).reduce((a, b) => a + b, 0);

  let x = 0;
  colData.forEach((c, j) => {
    const cw = Math.max(c.header.w, ...c.cells.map((g) => g.size.w), 90);
    const color = colorFor(j);
    nodes.push(mkNode(c.topic, x, headerY, { ...c.header, w: cw }, 1, "down", color));
    c.cells.forEach((g, r) => {
      nodes.push(mkNode(g.topic, x, rowY(r), { ...g.size, w: cw }, 2, "down", color));
    });
    if (j > 0) lines.push({ x1: x - gap / 2, y1: headerY - 6, x2: x - gap / 2, y2: rowY(maxRows) });
    x += cw + gap;
  });
  lines.push({ x1: -4, y1: headerY + headerH + 5, x2: x - gap, y2: headerY + headerH + 5 });
  return { nodes, gridLines: lines };
}

// --- tree-table: indented outline rows with separators ---------------------
function treeTable(sheet: Sheet): { nodes: LaidOutNode[]; gridLines: GridLine[] } {
  const nodes: LaidOutNode[] = [];
  const lines: GridLine[] = [];
  const indent = 28;
  let y = 0;
  const rowYs: number[] = [];
  const walk = (t: Topic, depth: number) => {
    const s = sizeOf(t);
    nodes.push(mkNode(t, depth * indent, y, s, depth, "down", depth === 0 ? ROOT_COLOR : colorFor(depth - 1)));
    y += s.h + 8;
    rowYs.push(y);
    for (const c of visibleChildren(t)) walk(c, depth + 1);
  };
  walk(sheet.rootTopic, 0);
  const fullW = Math.max(...nodes.map((n) => n.x + n.w));
  for (let r = 0; r < rowYs.length - 1; r++) lines.push({ x1: -6, y1: rowYs[r]! - 4, x2: fullW + 6, y2: rowYs[r]! - 4 });
  return { nodes, gridLines: lines };
}

export function layoutSheet(sheet: Sheet): Layout {
  const s: StructureId = sheet.structure;
  let nodes: LaidOutNode[];
  let edges: LaidOutEdge[] = [];
  let braces: SummaryDeco[] = [];
  let gridLines: GridLine[] = [];
  let kind: LaidOutEdge["kind"] = "bezier";
  let treeLike = true; // structures that use floating/boundaries/summaries + standard edges

  if (s === "fishbone.right" || s === "fishbone.left") {
    ({ nodes, edges } = fishbone(sheet, s.endsWith(".left") ? "left" : "right"));
    treeLike = false;
  } else if (s === "brace.right" || s === "brace.left") {
    ({ nodes, braces } = braceMap(sheet, s.endsWith(".left") ? "left" : "right"));
    treeLike = false;
  } else if (s === "matrix") {
    ({ nodes, gridLines } = matrix(sheet));
    treeLike = false;
  } else if (s === "tree-table") {
    ({ nodes, gridLines } = treeTable(sheet));
    treeLike = false;
  } else if (s === "org.down" || s === "org.up") {
    nodes = vertical(sheet, s === "org.up" ? "up" : "down");
  } else if (s === "timeline.v") {
    nodes = vertical(sheet, "down");
  } else if (s === "map.balanced") {
    nodes = horizontal(sheet, "balanced");
  } else {
    const left = s.endsWith(".left");
    kind = s.startsWith("map.") ? "bezier" : "elbow-h";
    nodes = horizontal(sheet, left ? "left" : "right");
  }

  if (!treeLike) {
    return normalize({ nodes, edges, boundaries: [], summaries: [], braces, gridLines, width: 0, height: 0, shiftX: 0, shiftY: 0 });
  }

  // Tree-like extras: floating topics, boundaries, summaries.
  (sheet.floatingTopics ?? []).forEach((f, i) => placeFloating(f, i, nodes));

  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Boundaries: a box behind the enclosed children's subtrees.
  const boundaries: BoundaryBox[] = [];
  for (const b of sheet.boundaries ?? []) {
    const ns = b.childIds.flatMap((cid) => {
      const node = byId.get(cid);
      return node ? subtreeNodeIds(node.topic).map((id) => byId.get(id)!).filter(Boolean) : [];
    });
    const bb = bboxOf(ns);
    if (!bb) continue;
    const pad = 10;
    boundaries.push({
      id: b.id, x: bb.minX - pad, y: bb.minY - pad,
      w: bb.maxX - bb.minX + 2 * pad, h: bb.maxY - bb.minY + 2 * pad,
      title: b.title, color: byId.get(b.childIds[0]!)?.color ?? "#8aa",
    });
  }

  // Summaries: a bracket spanning the children, plus the summary topic node.
  const summaries: SummaryDeco[] = [];
  for (const sm of sheet.summaries ?? []) {
    const ns = sm.childIds.flatMap((cid) => {
      const node = byId.get(cid);
      return node ? subtreeNodeIds(node.topic).map((id) => byId.get(id)!).filter(Boolean) : [];
    });
    const bb = bboxOf(ns);
    if (!bb) continue;
    const side = (byId.get(sm.childIds[0]!)?.side === "left" ? "left" : "right") as "left" | "right";
    const midY = (bb.minY + bb.maxY) / 2;
    const ss = sizeOf(sm.summaryTopic);
    const bx = side === "right" ? bb.maxX + 12 : bb.minX - 12;
    const nodeX = side === "right" ? bx + 22 : bx - 22 - ss.w;
    summaries.push({ id: sm.id, side, x: bx, y1: bb.minY, y2: bb.maxY });
    nodes.push(mkNode(sm.summaryTopic, nodeX, midY - ss.h / 2, ss, 2, side, SUMMARY_COLOR));
  }

  edges = buildEdges(nodes, kind);
  return normalize({ nodes, edges, boundaries, summaries, braces, gridLines, width: 0, height: 0, shiftX: 0, shiftY: 0 });
}

/** Back-compat alias used by tests. */
export const layoutBalanced = (sheet: Sheet): Layout => {
  const nodes = horizontal(sheet, "balanced");
  return normalize({ nodes, edges: buildEdges(nodes, "bezier"), boundaries: [], summaries: [], braces: [], gridLines: [], width: 0, height: 0, shiftX: 0, shiftY: 0 });
};

export function edgePath(e: LaidOutEdge): string {
  if (e.kind === "straight") return `M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`;
  if (e.kind === "elbow-h") {
    const mx = (e.x1 + e.x2) / 2;
    return `M ${e.x1} ${e.y1} H ${mx} V ${e.y2} H ${e.x2}`;
  }
  if (e.kind === "elbow-v") {
    const my = (e.y1 + e.y2) / 2;
    return `M ${e.x1} ${e.y1} V ${my} H ${e.x2} V ${e.y2}`;
  }
  const mx = (e.x1 + e.x2) / 2;
  return `M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`;
}

/** Brace path for a summary, bulging toward the summary node. */
export function summaryPath(s: SummaryDeco): string {
  const tip = s.side === "right" ? s.x + 16 : s.x - 16;
  const mid = (s.y1 + s.y2) / 2;
  return `M ${s.x} ${s.y1} Q ${tip} ${s.y1}, ${tip} ${mid} Q ${tip} ${s.y2}, ${s.x} ${s.y2}`;
}
