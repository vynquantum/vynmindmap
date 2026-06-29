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

export function widthOf(t: Topic): number {
  const longest = t.title.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
  const size = t.style?.font?.size ?? 13;
  const cw = CHAR_W * (size / 13) * (t.style?.font?.weight === "bold" ? 1.05 : 1);
  return Math.max(MIN_W, Math.min(MAX_W, longest * cw + PAD_X));
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
  const w = widthOf(t);
  const boxLeft = dir > 0 ? nearX : nearX - w;
  const farX = dir > 0 ? nearX + w : nearX - w;
  const kids = visibleChildren(t);
  let cy: number;
  if (kids.length === 0) {
    cy = cursor.v + NODE_H / 2;
    cursor.v += NODE_H + ROW_GAP;
  } else {
    const childNearX = farX + dir * LEVEL_GAP;
    const cys = kids.map((k) => placeH(k, depth + 1, side, dir, childNearX, color, cursor, nodes));
    cy = (cys[0]! + cys[cys.length - 1]!) / 2;
  }
  nodes.push({ id: t.id, topic: t, x: boxLeft, y: cy - NODE_H / 2, w, h: NODE_H, depth, side, color, hasHiddenChildren: hidden(t) });
  return cy;
}

function placeV(
  t: Topic, depth: number, side: "down" | "up", dir: 1 | -1,
  nearY: number, color: string, cursor: Cursor, nodes: LaidOutNode[],
): number {
  const w = widthOf(t);
  const boxTop = dir > 0 ? nearY : nearY - NODE_H;
  const farY = dir > 0 ? nearY + NODE_H : nearY - NODE_H;
  const kids = visibleChildren(t);
  let cx: number;
  if (kids.length === 0) {
    cx = cursor.v + w / 2;
    cursor.v += w + COL_GAP;
  } else {
    const childNearY = farY + dir * LEVEL_GAP;
    const cxs = kids.map((k) => placeV(k, depth + 1, side, dir, childNearY, color, cursor, nodes));
    cx = (cxs[0]! + cxs[cxs.length - 1]!) / 2;
  }
  nodes.push({ id: t.id, topic: t, x: cx - w / 2, y: boxTop, w, h: NODE_H, depth, side, color, hasHiddenChildren: hidden(t) });
  return cx;
}

function shiftRange(nodes: LaidOutNode[], from: number, dx: number, dy: number): void {
  for (let i = from; i < nodes.length; i++) { nodes[i]!.x += dx; nodes[i]!.y += dy; }
}

const colorFor = (i: number) => PALETTE[i % PALETTE.length]!;

function horizontal(sheet: Sheet, mode: "balanced" | "right" | "left"): LaidOutNode[] {
  const nodes: LaidOutNode[] = [];
  const root = sheet.rootTopic;
  const rootW = widthOf(root);
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
  for (const { t, i } of right) placeH(t, 1, "right", 1, rootW / 2 + LEVEL_GAP, colorFor(i), rc, nodes);
  shiftRange(nodes, rStart, 0, -Math.max(0, rc.v - ROW_GAP) / 2);

  const lStart = nodes.length;
  const lc: Cursor = { v: 0 };
  for (const { t, i } of left) placeH(t, 1, "left", -1, -rootW / 2 - LEVEL_GAP, colorFor(i), lc, nodes);
  shiftRange(nodes, lStart, 0, -Math.max(0, lc.v - ROW_GAP) / 2);

  nodes.push({ id: root.id, topic: root, x: -rootW / 2, y: -NODE_H / 2, w: rootW, h: NODE_H, depth: 0, side: "root", color: ROOT_COLOR, hasHiddenChildren: hidden(root) });
  return nodes;
}

function vertical(sheet: Sheet, dir: "down" | "up"): LaidOutNode[] {
  const nodes: LaidOutNode[] = [];
  const root = sheet.rootTopic;
  const rootW = widthOf(root);
  const d: 1 | -1 = dir === "down" ? 1 : -1;
  const kids = visibleChildren(root);

  const start = nodes.length;
  const c: Cursor = { v: 0 };
  kids.forEach((t, i) => placeV(t, 1, dir, d, (d > 0 ? NODE_H / 2 : -NODE_H / 2) + d * LEVEL_GAP, colorFor(i), c, nodes));
  shiftRange(nodes, start, -Math.max(0, c.v - COL_GAP) / 2, 0);

  nodes.push({ id: root.id, topic: root, x: -rootW / 2, y: -NODE_H / 2, w: rootW, h: NODE_H, depth: 0, side: "root", color: ROOT_COLOR, hasHiddenChildren: hidden(root) });
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
      if (n.side === "down" || n.side === "up" || cn.side === "down" || cn.side === "up") {
        const down = cn.y >= n.y;
        edges.push({ id: `${n.id}->${cn.id}`, x1: n.x + n.w / 2, y1: down ? n.y + n.h : n.y, x2: cn.x + cn.w / 2, y2: down ? cn.y : cn.y + cn.h, color: cn.color, kind: "elbow-v" });
      } else {
        const right = cn.x >= n.x;
        edges.push({ id: `${n.id}->${cn.id}`, x1: right ? n.x + n.w : n.x, y1: n.y + n.h / 2, x2: right ? cn.x : cn.x + cn.w, y2: cn.y + cn.h / 2, color: cn.color, kind });
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
  const rootW = widthOf(root);
  const sgn = dir === "right" ? 1 : -1;
  nodes.push({ id: root.id, topic: root, x: -rootW / 2, y: -NODE_H / 2, w: rootW, h: NODE_H, depth: 0, side: "root", color: ROOT_COLOR, hasHiddenChildren: hidden(root) });

  const bones = visibleChildren(root);
  const pairs = Math.max(1, Math.ceil(bones.length / 2));
  const spineLen = Math.max(260, pairs * 170);
  const headX = sgn > 0 ? -rootW / 2 : rootW / 2;
  const tailX = headX - sgn * spineLen;
  edges.push({ id: "spine", x1: headX, y1: 0, x2: tailX, y2: 0, color: "#64748b", kind: "straight", width: 3 });

  const boneDX = 48, boneDY = 104;
  bones.forEach((b, i) => {
    const above = i % 2 === 0;
    const slot = Math.floor(i / 2) + 1;
    const attachX = headX - sgn * spineLen * (slot / (pairs + 1));
    const color = colorFor(i);
    const bw = widthOf(b);
    const cyB = above ? -boneDY : boneDY;
    const cxB = attachX - sgn * boneDX;
    nodes.push({ id: b.id, topic: b, x: cxB - bw / 2, y: cyB - NODE_H / 2, w: bw, h: NODE_H, depth: 1, side: "right", color, hasHiddenChildren: hidden(b) });
    edges.push({ id: `bone-${b.id}`, x1: attachX, y1: 0, x2: cxB, y2: cyB + (above ? NODE_H / 2 : -NODE_H / 2), color, kind: "straight", width: 2 });
    visibleChildren(b).forEach((c, k) => {
      const cw = widthOf(c);
      const cyC = cyB + (above ? -1 : 1) * ((k + 1) * (NODE_H + 12));
      const cxC = cxB - sgn * 26;
      nodes.push({ id: c.id, topic: c, x: cxC - cw / 2, y: cyC - NODE_H / 2, w: cw, h: NODE_H, depth: 2, side: "right", color, hasHiddenChildren: hidden(c) });
      edges.push({ id: `fb-${c.id}`, x1: cxB, y1: cyB, x2: cxC, y2: cyC, color, kind: "straight", width: 1.5 });
    });
  });
  return { nodes, edges };
}

// --- matrix: columns of cells under level-1 headers ------------------------
function matrix(sheet: Sheet): { nodes: LaidOutNode[]; gridLines: GridLine[] } {
  const nodes: LaidOutNode[] = [];
  const lines: GridLine[] = [];
  const root = sheet.rootTopic;
  const cols = visibleChildren(root);
  const rowH = NODE_H + 10;
  const gap = 12;
  nodes.push({ id: root.id, topic: root, x: 0, y: 0, w: widthOf(root), h: NODE_H, depth: 0, side: "down", color: ROOT_COLOR, hasHiddenChildren: hidden(root) });
  const headerY = NODE_H + 20;
  const maxRows = Math.max(0, ...cols.map((c) => visibleChildren(c).length));
  let x = 0;
  cols.forEach((c, j) => {
    const cw = Math.max(widthOf(c), ...visibleChildren(c).map((g) => widthOf(g)), 90);
    const color = colorFor(j);
    nodes.push({ id: c.id, topic: c, x, y: headerY, w: cw, h: NODE_H, depth: 1, side: "down", color, hasHiddenChildren: hidden(c) });
    visibleChildren(c).forEach((g, r) => {
      nodes.push({ id: g.id, topic: g, x, y: headerY + (r + 1) * rowH, w: cw, h: NODE_H, depth: 2, side: "down", color, hasHiddenChildren: hidden(g) });
    });
    if (j > 0) lines.push({ x1: x - gap / 2, y1: headerY - 6, x2: x - gap / 2, y2: headerY + (maxRows + 1) * rowH });
    x += cw + gap;
  });
  lines.push({ x1: -4, y1: headerY + NODE_H + 6, x2: x - gap, y2: headerY + NODE_H + 6 });
  return { nodes, gridLines: lines };
}

// --- tree-table: indented outline rows with separators ---------------------
function treeTable(sheet: Sheet): { nodes: LaidOutNode[]; gridLines: GridLine[] } {
  const nodes: LaidOutNode[] = [];
  const lines: GridLine[] = [];
  const rowH = NODE_H + 8;
  const indent = 28;
  let row = 0;
  const walk = (t: Topic, depth: number) => {
    nodes.push({ id: t.id, topic: t, x: depth * indent, y: row * rowH, w: widthOf(t), h: NODE_H, depth, side: "down", color: depth === 0 ? ROOT_COLOR : colorFor(depth - 1), hasHiddenChildren: hidden(t) });
    row++;
    for (const c of visibleChildren(t)) walk(c, depth + 1);
  };
  walk(sheet.rootTopic, 0);
  const fullW = Math.max(...nodes.map((n) => n.x + n.w));
  for (let r = 1; r < row; r++) lines.push({ x1: -6, y1: r * rowH - 4, x2: fullW + 6, y2: r * rowH - 4 });
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
    const w = widthOf(sm.summaryTopic);
    const bx = side === "right" ? bb.maxX + 12 : bb.minX - 12;
    const nodeX = side === "right" ? bx + 22 : bx - 22 - w;
    summaries.push({ id: sm.id, side, x: bx, y1: bb.minY, y2: bb.maxY });
    nodes.push({
      id: sm.summaryTopic.id, topic: sm.summaryTopic, x: nodeX, y: midY - NODE_H / 2,
      w, h: NODE_H, depth: 2, side, color: SUMMARY_COLOR, hasHiddenChildren: false,
    });
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
