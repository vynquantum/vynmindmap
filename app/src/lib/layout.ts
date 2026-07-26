/**
 * Layout for VynMM sheets (DESIGN.md §5.1).
 *
 * Pure geometry: a `Sheet` in → positioned boxes, edges, boundaries, summaries.
 * `layoutSheet` dispatches on the sheet's `structure` and also places floating
 * topics and the decorations (boundaries / summaries) that wrap topic groups.
 */

import type { Sheet, StructureId, Topic } from '../../../src/index.js';
import { isTextOnLines, paletteForSheet, rootColorForSheet } from './mapAppearance.js';

export interface LaidOutNode {
  id: string;
  topic: Topic;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  side: 'root' | 'left' | 'right' | 'down' | 'up';
  color: string;
  hasHiddenChildren: boolean;
  /** Title split into rendered lines (explicit \n plus word wrap). */
  lines: string[];
  /** Vertical distance between rendered lines. */
  lineH: number;
  /** Note text drawn under the title; empty unless 'Display All Notes'. */
  noteLines: string[];
  floating?: boolean;
}

export interface LaidOutEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  kind: 'bezier' | 'elbow-h' | 'elbow-v' | 'straight' | 'underline';
  width?: number;
}

export interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface BoundaryBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  color: string;
}

export interface SummaryDeco {
  id: string;
  side: 'left' | 'right';
  x: number;
  y1: number;
  y2: number;
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
const SPACING = { row: 14, col: 26, level: 56 };
let ROW_GAP = SPACING.row;
let COL_GAP = SPACING.col;
let LEVEL_GAP = SPACING.level;
const CHAR_W = 7.6;
const PAD_X = 26;
const PAD_Y = 8;
const MIN_W = 56;
const MAX_W = 260;
const MAX_MANUAL_W = 800;
const MARGIN = 56;

const FLOAT_COLOR = '#7a8699';
const SUMMARY_COLOR = '#64748b';

/**
 * Per-sheet measurement knobs, applied by `applySettings` before any placement
 * runs. They live here rather than as parameters because `sizeOf` is called
 * from every placement function and from the recursive helpers underneath them.
 *
 * ponytail: module-global, safe only because layoutSheet is synchronous and
 * runs one sheet at a time. Laying out sheets concurrently (a worker, or async
 * chunking for large maps) would have to pass these down as an options object.
 */
let uniformW = 0;
let showNotes = false;

/** Reset the knobs from a sheet's settings. Call once, before placement. */
function applySettings(sheet: Sheet): void {
  const density = sheet.settings?.compactMap === true ? 0.5 : 1;
  ROW_GAP = Math.round(SPACING.row * density);
  COL_GAP = Math.round(SPACING.col * density);
  LEVEL_GAP = Math.round(SPACING.level * density);

  showNotes = sheet.settings?.displayAllNotes === true;
  // Measured with the knob off so the widest topic is its own natural width,
  // not a previous sheet's uniform width fed back in.
  uniformW = 0;
  if (sheet.settings?.uniformTopicLength === true) {
    let widest = 0;
    for (const t of everyTopic(sheet)) widest = Math.max(widest, sizeOf(t).w);
    uniformW = widest;
  }
}

/** Every topic the sheet can place, root subtree plus floating subtrees. */
function* everyTopic(sheet: Sheet): Generator<Topic> {
  const stack: Topic[] = [sheet.rootTopic, ...(sheet.floatingTopics ?? [])];
  while (stack.length) {
    const t = stack.pop()!;
    yield t;
    // Collapsed children are unmeasured on purpose: they are not placed, so
    // they must not widen the topics that are.
    stack.push(...visibleChildren(t));
  }
}

// Sizing / wrapping ----------------------------------------------------------

export interface TopicSize {
  w: number;
  h: number;
  lines: string[];
  lineH: number;
  /** Note text rendered under the title; empty unless 'Display All Notes'. */
  noteLines: string[];
}

/** Greedy word wrap, honoring explicit newlines and hard-breaking long words. */
function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    if (raw.length <= maxChars) {
      lines.push(raw);
      continue;
    }
    let cur = '';
    for (let word of raw.split(/ +/)) {
      while (word.length > maxChars) {
        // A single over-long word: flush and hard-break it.
        if (cur) {
          lines.push(cur);
          cur = '';
        }
        lines.push(word.slice(0, maxChars));
        word = word.slice(maxChars);
      }
      if (!cur) cur = word;
      else if (cur.length + 1 + word.length <= maxChars) cur += ' ' + word;
      else {
        lines.push(cur);
        cur = word;
      }
    }
    lines.push(cur);
  }
  return lines.length ? lines : [''];
}

/** Note lines are smaller than the title and capped, so one long note can't
 * stretch a topic past the rest of the map. */
export const NOTE_LINE_H = 15;
const NOTE_MAX_LINES = 4;

/**
 * Measure a topic box: wraps the title (explicit newlines + greedy word wrap)
 * to at most MAX_W, and grows the box height to fit all lines.
 */
export function sizeOf(t: Topic): TopicSize {
  const size = t.style?.font?.size ?? 13;
  const cw = CHAR_W * (size / 13) * (t.style?.font?.weight === 'bold' ? 1.05 : 1);
  // Automatic topics stop expanding at MAX_W. A user-specified width is a
  // layout preference: it controls wrapping and is retained in the document.
  const requestedWidth = t.style?.width;
  const fixedWidth = Number.isFinite(requestedWidth) ? clampTopicWidth(requestedWidth!) : undefined;
  const maxChars = Math.max(4, Math.floor(((fixedWidth ?? MAX_W) - PAD_X) / cw));

  const lines = wrap(t.title ?? '', maxChars);

  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const lineH = Math.max(18, size + 5);
  const natural = Math.max(MIN_W, Math.min(MAX_W, longest * cw + PAD_X));
  // Uniform length only ever widens: the shared width is the widest natural
  // width on the sheet, so no title has to re-wrap to fit it.
  const w = fixedWidth ?? Math.max(natural, uniformW);

  const note = showNotes ? (t.note?.plain ?? '').trim() : '';
  const noteLines = note
    ? wrap(note, Math.max(4, Math.floor((w - PAD_X) / (CHAR_W * 0.85)))).slice(0, NOTE_MAX_LINES)
    : [];

  const minHeight = Number.isFinite(t.style?.minHeight) ? t.style!.minHeight! : 0;
  const h = Math.max(
    NODE_H,
    Math.round(minHeight),
    lines.length * lineH + noteLines.length * NOTE_LINE_H + PAD_Y * 2
  );
  return { w, h, lines, lineH, noteLines };
}

/** Back-compat width-only measure. */
export function widthOf(t: Topic): number {
  return sizeOf(t).w;
}

/** Clamp a user-requested topic width to the bounds layout enforces. */
export function clampTopicWidth(px: number): number {
  return Math.max(MIN_W, Math.min(MAX_MANUAL_W, Math.round(px)));
}

/** Clamp a user-requested topic minimum height likewise. */
export function clampTopicMinHeight(px: number): number {
  return Math.max(NODE_H, Math.round(px));
}

function mkNode(
  t: Topic,
  x: number,
  y: number,
  s: TopicSize,
  depth: number,
  side: LaidOutNode['side'],
  color: string
): LaidOutNode {
  return {
    id: t.id,
    topic: t,
    x,
    y,
    w: s.w,
    h: s.h,
    depth,
    side,
    color,
    hasHiddenChildren: hidden(t),
    lines: s.lines,
    lineH: s.lineH,
    noteLines: s.noteLines
  };
}

function visibleChildren(t: Topic): Topic[] {
  return t.collapsed ? [] : (t.children ?? []);
}
function hidden(t: Topic): boolean {
  return t.collapsed === true && (t.children?.length ?? 0) > 0;
}

interface Cursor {
  v: number;
}

function placeH(
  t: Topic,
  depth: number,
  side: 'left' | 'right',
  dir: 1 | -1,
  nearX: number,
  color: string,
  cursor: Cursor,
  nodes: LaidOutNode[]
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
  t: Topic,
  depth: number,
  side: 'down' | 'up',
  dir: 1 | -1,
  nearY: number,
  color: string,
  cursor: Cursor,
  nodes: LaidOutNode[]
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
  for (let i = from; i < nodes.length; i++) {
    nodes[i]!.x += dx;
    nodes[i]!.y += dy;
  }
}

const colorFor = (i: number, palette: readonly string[]) => palette[i % palette.length]!;

function horizontal(sheet: Sheet, mode: 'balanced' | 'right' | 'left'): LaidOutNode[] {
  const nodes: LaidOutNode[] = [];
  const root = sheet.rootTopic;
  const rootS = sizeOf(root);
  const kids = visibleChildren(root);
  const palette = paletteForSheet(sheet);

  const right: { t: Topic; i: number }[] = [];
  const left: { t: Topic; i: number }[] = [];
  kids.forEach((t, i) => {
    if (mode === 'left') left.push({ t, i });
    else if (mode === 'right') right.push({ t, i });
    else (i % 2 === 0 ? right : left).push({ t, i });
  });

  const rStart = nodes.length;
  const rc: Cursor = { v: 0 };
  for (const { t, i } of right)
    placeH(t, 1, 'right', 1, rootS.w / 2 + LEVEL_GAP, colorFor(i, palette), rc, nodes);
  shiftRange(nodes, rStart, 0, -Math.max(0, rc.v - ROW_GAP) / 2);

  const lStart = nodes.length;
  const lc: Cursor = { v: 0 };
  for (const { t, i } of left)
    placeH(t, 1, 'left', -1, -rootS.w / 2 - LEVEL_GAP, colorFor(i, palette), lc, nodes);
  shiftRange(nodes, lStart, 0, -Math.max(0, lc.v - ROW_GAP) / 2);

  nodes.push(mkNode(root, -rootS.w / 2, -rootS.h / 2, rootS, 0, 'root', rootColorForSheet(sheet)));
  return nodes;
}

function vertical(sheet: Sheet, dir: 'down' | 'up'): LaidOutNode[] {
  const nodes: LaidOutNode[] = [];
  const root = sheet.rootTopic;
  const rootS = sizeOf(root);
  const d: 1 | -1 = dir === 'down' ? 1 : -1;
  const kids = visibleChildren(root);
  const palette = paletteForSheet(sheet);

  const start = nodes.length;
  const c: Cursor = { v: 0 };
  kids.forEach((t, i) =>
    placeV(
      t,
      1,
      dir,
      d,
      (d > 0 ? rootS.h / 2 : -rootS.h / 2) + d * LEVEL_GAP,
      colorFor(i, palette),
      c,
      nodes
    )
  );
  shiftRange(nodes, start, -Math.max(0, c.v - COL_GAP) / 2, 0);

  nodes.push(mkNode(root, -rootS.w / 2, -rootS.h / 2, rootS, 0, 'root', rootColorForSheet(sheet)));
  return nodes;
}

/** Place a floating topic's subtree, anchored at its stored position. */
function placeFloating(topic: Topic, index: number, nodes: LaidOutNode[], color: string): void {
  const sub: LaidOutNode[] = [];
  placeH(topic, 1, 'right', 1, 0, color, { v: 0 }, sub);
  const root = sub.find((n) => n.id === topic.id)!;
  const px = topic.position?.x ?? 360;
  const py = topic.position?.y ?? -160 + index * 90;
  const dx = px - root.x;
  const dy = py - root.y;
  for (const n of sub) {
    n.x += dx;
    n.y += dy;
    n.floating = true;
  }
  nodes.push(...sub);
}

function buildEdges(sheet: Sheet, nodes: LaidOutNode[], kind: LaidOutEdge['kind']): LaidOutEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: LaidOutEdge[] = [];
  for (const n of nodes) {
    for (const child of visibleChildren(n.topic)) {
      const cn = byId.get(child.id);
      if (!cn) continue;
      const color = cn.topic.style?.lineColor ?? cn.color;
      const width = cn.topic.style?.lineWidth ?? sheet.settings?.branchLineWidth ?? 2.5;
      if (n.side === 'down' || n.side === 'up' || cn.side === 'down' || cn.side === 'up') {
        const down = cn.y >= n.y;
        edges.push({
          id: `${n.id}->${cn.id}`,
          x1: n.x + n.w / 2,
          y1: down ? n.y + n.h : n.y,
          x2: cn.x + cn.w / 2,
          y2: down ? cn.y : cn.y + cn.h,
          color,
          // Vertical charts support straight diagonals; curves stay elbowed
          // because the bezier path is horizontal-oriented.
          kind: sheet.settings?.branchStyle === 'straight' ? 'straight' : 'elbow-v',
          width
        });
      } else if (kind === 'underline') {
        // Underlines run outward from the root, so a left-side branch mirrors
        // every anchor: the parent's outer end and the child's near/far ends.
        const right = cn.x >= n.x;
        const parentEnd = right ? n.x + n.w : n.x;
        const childNear = right ? cn.x : cn.x + cn.w;
        const childFar = right ? cn.x + cn.w : cn.x;
        // Every link is a connector branching off the parent's line, then the
        // child's own underline. The root is boxed, so it is met at its middle.
        edges.push({
          id: `${n.id}->${cn.id}-conn`,
          x1: parentEnd,
          y1: n.depth === 0 ? n.y + n.h / 2 : n.y + n.h,
          x2: childNear,
          y2: cn.y + cn.h,
          color,
          kind: styleKind(sheet, 'bezier'),
          width
        });
        edges.push({
          id: `${n.id}->${cn.id}-line`,
          x1: childNear,
          y1: cn.y + cn.h,
          x2: childFar,
          y2: cn.y + cn.h,
          color,
          kind: 'straight',
          width
        });
      } else {
        const right = cn.x >= n.x;
        edges.push({
          id: `${n.id}->${cn.id}`,
          x1: right ? n.x + n.w : n.x,
          y1: n.y + n.h / 2,
          x2: right ? cn.x : cn.x + cn.w,
          y2: cn.y + cn.h / 2,
          color,
          kind,
          width
        });
      }
    }
  }
  return edges;
}

function subtreeNodeIds(topic: Topic): string[] {
  const ids: string[] = [];
  const walk = (t: Topic) => {
    ids.push(t.id);
    for (const c of visibleChildren(t)) walk(c);
  };
  walk(topic);
  return ids;
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
function bboxOf(ns: LaidOutNode[]): BBox | null {
  if (!ns.length) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of ns) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }
  return { minX, minY, maxX, maxY };
}

function normalize(layout: Layout): Layout {
  const { nodes, edges, boundaries, summaries, braces, gridLines } = layout;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }
  for (const b of boundaries) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  for (const e of edges) {
    minX = Math.min(minX, e.x1, e.x2);
    minY = Math.min(minY, e.y1, e.y2);
    maxX = Math.max(maxX, e.x1, e.x2);
    maxY = Math.max(maxY, e.y1, e.y2);
  }
  const dx = MARGIN - minX,
    dy = MARGIN - minY;
  for (const n of nodes) {
    n.x += dx;
    n.y += dy;
  }
  for (const e of edges) {
    e.x1 += dx;
    e.y1 += dy;
    e.x2 += dx;
    e.y2 += dy;
  }
  for (const b of boundaries) {
    b.x += dx;
    b.y += dy;
  }
  for (const s of summaries) {
    s.x += dx;
    s.y1 += dy;
    s.y2 += dy;
  }
  for (const s of braces) {
    s.x += dx;
    s.y1 += dy;
    s.y2 += dy;
  }
  for (const l of gridLines) {
    l.x1 += dx;
    l.y1 += dy;
    l.x2 += dx;
    l.y2 += dy;
  }
  layout.width = maxX - minX + MARGIN * 2;
  layout.height = maxY - minY + MARGIN * 2;
  layout.shiftX = dx;
  layout.shiftY = dy;
  return layout;
}

// --- brace map: horizontal tree, children grouped by braces instead of lines ---
function braceMap(
  sheet: Sheet,
  side: 'left' | 'right'
): { nodes: LaidOutNode[]; braces: SummaryDeco[] } {
  const nodes = horizontal(sheet, side);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const braces: SummaryDeco[] = [];
  for (const n of nodes) {
    const kids = visibleChildren(n.topic)
      .map((c) => byId.get(c.id)!)
      .filter(Boolean);
    if (!kids.length) continue;
    const y1 = Math.min(...kids.map((k) => k.y));
    const y2 = Math.max(...kids.map((k) => k.y + k.h));
    const farX = side === 'right' ? n.x + n.w : n.x;
    const childNear =
      side === 'right'
        ? Math.min(...kids.map((k) => k.x))
        : Math.max(...kids.map((k) => k.x + k.w));
    braces.push({ id: 'brace-' + n.id, side, x: (farX + childNear) / 2, y1, y2 });
  }
  return { nodes, braces };
}

// --- fishbone / Ishikawa: spine + alternating diagonal bones --------------
function fishbone(
  sheet: Sheet,
  dir: 'left' | 'right'
): { nodes: LaidOutNode[]; edges: LaidOutEdge[] } {
  const nodes: LaidOutNode[] = [];
  const edges: LaidOutEdge[] = [];
  const root = sheet.rootTopic;
  const rootS = sizeOf(root);
  const sgn = dir === 'right' ? 1 : -1;
  nodes.push(mkNode(root, -rootS.w / 2, -rootS.h / 2, rootS, 0, 'root', rootColorForSheet(sheet)));

  const bones = visibleChildren(root);
  const pairs = Math.max(1, Math.ceil(bones.length / 2));
  const spineLen = Math.max(260, pairs * 170);
  const headX = sgn > 0 ? -rootS.w / 2 : rootS.w / 2;
  const tailX = headX - sgn * spineLen;
  edges.push({
    id: 'spine',
    x1: headX,
    y1: 0,
    x2: tailX,
    y2: 0,
    color: '#64748b',
    kind: 'straight',
    width: 3
  });

  const boneDX = 48,
    boneDY = 104;
  bones.forEach((b, i) => {
    const above = i % 2 === 0;
    const slot = Math.floor(i / 2) + 1;
    const attachX = headX - sgn * spineLen * (slot / (pairs + 1));
    const color = colorFor(i, paletteForSheet(sheet));
    const bs = sizeOf(b);
    const cyB = above ? -boneDY : boneDY;
    const cxB = attachX - sgn * boneDX;
    nodes.push(mkNode(b, cxB - bs.w / 2, cyB - bs.h / 2, bs, 1, 'right', color));
    edges.push({
      id: `bone-${b.id}`,
      x1: attachX,
      y1: 0,
      x2: cxB,
      y2: cyB + (above ? bs.h / 2 : -bs.h / 2),
      color,
      kind: 'straight',
      width: 2
    });
    // Sub-bones stack outward from the bone. Each connector starts at the
    // previous box's outer edge, so none of them crosses a box it doesn't touch.
    let edgeX = cxB;
    let edgeY = cyB + (above ? -bs.h / 2 : bs.h / 2);
    for (const c of visibleChildren(b)) {
      const cs = sizeOf(c);
      const cyC = above ? edgeY - 12 - cs.h / 2 : edgeY + 12 + cs.h / 2;
      const cxC = cxB - sgn * 26;
      nodes.push(mkNode(c, cxC - cs.w / 2, cyC - cs.h / 2, cs, 2, 'right', color));
      edges.push({
        id: `fb-${c.id}`,
        x1: edgeX,
        y1: edgeY,
        x2: cxC,
        y2: above ? cyC + cs.h / 2 : cyC - cs.h / 2,
        color,
        kind: 'straight',
        width: 1.5
      });
      edgeX = cxC;
      edgeY = above ? cyC - cs.h / 2 : cyC + cs.h / 2;
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
  const indent = 20;
  const rootS = sizeOf(root);
  nodes.push(mkNode(root, 0, 0, rootS, 0, 'down', rootColorForSheet(sheet)));
  const headerY = rootS.h + 20;

  // Measure every cell first so each row can size to its tallest member. A
  // column lists its whole subtree, indented, so no topic is dropped for depth.
  const colData = cols.map((c) => {
    const cells: { topic: Topic; size: ReturnType<typeof sizeOf>; depth: number }[] = [];
    const walk = (t: Topic, depth: number) => {
      cells.push({ topic: t, size: sizeOf(t), depth });
      for (const g of visibleChildren(t)) walk(g, depth + 1);
    };
    for (const g of visibleChildren(c)) walk(g, 0);
    return { topic: c, header: sizeOf(c), cells };
  });
  const maxRows = Math.max(0, ...colData.map((c) => c.cells.length));
  const headerH = Math.max(NODE_H, ...colData.map((c) => c.header.h));
  const rowHs: number[] = [];
  for (let r = 0; r < maxRows; r++) {
    rowHs.push(Math.max(NODE_H, ...colData.map((c) => c.cells[r]?.size.h ?? 0)) + 10);
  }
  const rowY = (r: number) => headerY + headerH + 10 + rowHs.slice(0, r).reduce((a, b) => a + b, 0);

  let x = 0;
  colData.forEach((c, j) => {
    const cw = Math.max(c.header.w, ...c.cells.map((g) => g.size.w + g.depth * indent), 90);
    const color = colorFor(j, paletteForSheet(sheet));
    nodes.push(mkNode(c.topic, x, headerY, { ...c.header, w: cw }, 1, 'down', color));
    c.cells.forEach((g, r) => {
      const off = g.depth * indent;
      nodes.push(mkNode(g.topic, x + off, rowY(r), { ...g.size, w: cw - off }, 2, 'down', color));
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
    nodes.push(
      mkNode(
        t,
        depth * indent,
        y,
        s,
        depth,
        'down',
        depth === 0 ? rootColorForSheet(sheet) : colorFor(depth - 1, paletteForSheet(sheet))
      )
    );
    y += s.h + 8;
    rowYs.push(y);
    for (const c of visibleChildren(t)) walk(c, depth + 1);
  };
  walk(sheet.rootTopic, 0);
  const fullW = Math.max(...nodes.map((n) => n.x + n.w));
  for (let r = 0; r < rowYs.length - 1; r++)
    lines.push({ x1: -6, y1: rowYs[r]! - 4, x2: fullW + 6, y2: rowYs[r]! - 4 });
  return { nodes, gridLines: lines };
}

// --- grid: level-1 topics as uniform cards, subtrees stacked inside --------
function grid(sheet: Sheet): { nodes: LaidOutNode[]; gridLines: GridLine[] } {
  const nodes: LaidOutNode[] = [];
  const lines: GridLine[] = [];
  const root = sheet.rootTopic;
  const kids = visibleChildren(root);
  const rootS = sizeOf(root);
  const cols = Math.max(1, Math.ceil(Math.sqrt(kids.length)));
  const nRows = Math.ceil(kids.length / cols);
  const gapX = 18;
  const gapY = 18;
  const indent = 20;
  const topY = rootS.h + 24;

  // Measure each cell: the level-1 header with its descendants listed below.
  const cells = kids.map((t) => {
    const rows: { topic: Topic; s: ReturnType<typeof sizeOf>; depth: number }[] = [];
    const walk = (x: Topic, depth: number) => {
      rows.push({ topic: x, s: sizeOf(x), depth });
      for (const c of visibleChildren(x)) walk(c, depth + 1);
    };
    walk(t, 0);
    return {
      rows,
      w: Math.max(120, ...rows.map((r) => r.s.w + r.depth * indent)),
      h: rows.reduce((a, r) => a + r.s.h + 6, 0)
    };
  });
  const colW: number[] = [];
  for (let j = 0; j < cols; j++)
    colW.push(Math.max(0, ...cells.filter((_, i) => i % cols === j).map((c) => c.w)));
  const rowH: number[] = [];
  for (let r = 0; r < nRows; r++)
    rowH.push(Math.max(0, ...cells.slice(r * cols, r * cols + cols).map((c) => c.h)));
  const colX = (j: number) => colW.slice(0, j).reduce((a, b) => a + b + gapX, 0);
  const rowY = (r: number) => topY + rowH.slice(0, r).reduce((a, b) => a + b + gapY, 0);
  const fullW = cols ? colX(cols - 1) + (colW[cols - 1] ?? 0) : rootS.w;

  nodes.push(mkNode(root, (fullW - rootS.w) / 2, 0, rootS, 0, 'down', rootColorForSheet(sheet)));
  cells.forEach((cell, i) => {
    const j = i % cols;
    const r = Math.floor(i / cols);
    const color = colorFor(i, paletteForSheet(sheet));
    let y = rowY(r);
    cell.rows.forEach((row, k) => {
      nodes.push(
        mkNode(
          row.topic,
          colX(j) + row.depth * indent,
          y,
          k === 0 ? { ...row.s, w: colW[j]! } : row.s,
          k === 0 ? 1 : 2,
          'down',
          color
        )
      );
      y += row.s.h + 6;
    });
  });
  for (let j = 1; j < cols; j++)
    lines.push({
      x1: colX(j) - gapX / 2,
      y1: topY - 6,
      x2: colX(j) - gapX / 2,
      y2: rowY(nRows - 1) + (rowH[nRows - 1] ?? 0) + 6
    });
  return { nodes, gridLines: lines };
}

/** Connector geometry from the sheet's branch style; each structure family
 * keeps its own default when unset. */
function styleKind(sheet: Sheet, fallback: LaidOutEdge['kind']): LaidOutEdge['kind'] {
  const style = sheet.settings?.branchStyle;
  if (style === 'straight') return 'straight';
  if (style === 'elbow') return 'elbow-h';
  if (style === 'curve') return 'bezier';
  return fallback;
}

/** Edge geometry for connector-based structures. The text-on-lines treatment
 * reshapes the connectors into underlines; only the horizontal structures call
 * this, which is exactly where that treatment applies. */
function branchKind(sheet: Sheet, fallback: LaidOutEdge['kind']): LaidOutEdge['kind'] {
  return isTextOnLines(sheet) ? 'underline' : styleKind(sheet, fallback);
}

export function layoutSheet(sheet: Sheet): Layout {
  applySettings(sheet);
  const s: StructureId = sheet.structure;
  let nodes: LaidOutNode[];
  let edges: LaidOutEdge[] = [];
  let braces: SummaryDeco[] = [];
  let gridLines: GridLine[] = [];
  let kind: LaidOutEdge['kind'] = 'bezier';
  let treeLike = true; // structures that use floating/boundaries/summaries + standard edges

  if (s === 'fishbone.right' || s === 'fishbone.left') {
    ({ nodes, edges } = fishbone(sheet, s.endsWith('.left') ? 'left' : 'right'));
    treeLike = false;
  } else if (s === 'brace.right' || s === 'brace.left') {
    ({ nodes, braces } = braceMap(sheet, s.endsWith('.left') ? 'left' : 'right'));
    treeLike = false;
  } else if (s === 'matrix') {
    ({ nodes, gridLines } = matrix(sheet));
    treeLike = false;
  } else if (s === 'tree-table') {
    ({ nodes, gridLines } = treeTable(sheet));
    treeLike = false;
  } else if (s === 'grid') {
    ({ nodes, gridLines } = grid(sheet));
    treeLike = false;
  } else if (s === 'org.down' || s === 'org.up') {
    nodes = vertical(sheet, s === 'org.up' ? 'up' : 'down');
  } else if (s === 'timeline.v') {
    nodes = vertical(sheet, 'down');
  } else if (s === 'map.balanced') {
    kind = branchKind(sheet, 'bezier');
    nodes = horizontal(sheet, 'balanced');
  } else {
    const left = s.endsWith('.left');
    kind = branchKind(sheet, s.startsWith('map.') ? 'bezier' : 'elbow-h');
    nodes = horizontal(sheet, left ? 'left' : 'right');
  }

  // Floating topics carry their own canvas position and their own subtree, so
  // they belong on every chart type — no structure may silently drop them.
  const floating: LaidOutNode[] = [];
  const floatPalette = paletteForSheet(sheet);
  const autoColorFloat = sheet.settings?.autoColorFloating === true;
  (sheet.floatingTopics ?? []).forEach((f, i) =>
    placeFloating(f, i, floating, autoColorFloat ? colorFor(i, floatPalette) : FLOAT_COLOR)
  );

  nodes.push(...floating);

  // Boundaries and summaries are read off the placed nodes, so they work for
  // every chart type — no structure may silently drop them either.

  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Boundaries: a box behind the enclosed children's subtrees.
  const boundaries: BoundaryBox[] = [];
  for (const b of sheet.boundaries ?? []) {
    const ns = b.childIds.flatMap((cid) => {
      const node = byId.get(cid);
      return node
        ? subtreeNodeIds(node.topic)
            .map((id) => byId.get(id)!)
            .filter(Boolean)
        : [];
    });
    const bb = bboxOf(ns);
    if (!bb) continue;
    const pad = 10;
    boundaries.push({
      id: b.id,
      x: bb.minX - pad,
      y: bb.minY - pad,
      w: bb.maxX - bb.minX + 2 * pad,
      h: bb.maxY - bb.minY + 2 * pad,
      title: b.title,
      color: byId.get(b.childIds[0]!)?.color ?? '#8aa'
    });
  }

  // Summaries: a bracket spanning the children, plus the summary topic node.
  const summaries: SummaryDeco[] = [];
  for (const sm of sheet.summaries ?? []) {
    const ns = sm.childIds.flatMap((cid) => {
      const node = byId.get(cid);
      return node
        ? subtreeNodeIds(node.topic)
            .map((id) => byId.get(id)!)
            .filter(Boolean)
        : [];
    });
    const bb = bboxOf(ns);
    if (!bb) continue;
    const side = (byId.get(sm.childIds[0]!)?.side === 'left' ? 'left' : 'right') as
      'left' | 'right';
    const midY = (bb.minY + bb.maxY) / 2;
    const ss = sizeOf(sm.summaryTopic);
    const bx = side === 'right' ? bb.maxX + 12 : bb.minX - 12;
    const nodeX = side === 'right' ? bx + 22 : bx - 22 - ss.w;
    summaries.push({ id: sm.id, side, x: bx, y1: bb.minY, y2: bb.maxY });
    nodes.push(mkNode(sm.summaryTopic, nodeX, midY - ss.h / 2, ss, 2, side, SUMMARY_COLOR));
  }

  edges = treeLike
    ? buildEdges(sheet, nodes, kind)
    : // These structures draw their own edges, so the floating subtrees — the
      // only topics they didn't place themselves — bring only their own.
      [...edges, ...buildEdges(sheet, floating, styleKind(sheet, 'bezier'))];
  return normalize({
    nodes,
    edges,
    boundaries,
    summaries,
    braces,
    gridLines,
    width: 0,
    height: 0,
    shiftX: 0,
    shiftY: 0
  });
}

/** Back-compat alias used by tests. */
export const layoutBalanced = (sheet: Sheet): Layout => {
  const nodes = horizontal(sheet, 'balanced');
  return normalize({
    nodes,
    edges: buildEdges(sheet, nodes, 'bezier'),
    boundaries: [],
    summaries: [],
    braces: [],
    gridLines: [],
    width: 0,
    height: 0,
    shiftX: 0,
    shiftY: 0
  });
};

export function edgePath(e: LaidOutEdge): string {
  if (e.kind === 'straight') return `M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`;
  if (e.kind === 'elbow-h') {
    const mx = (e.x1 + e.x2) / 2;
    return `M ${e.x1} ${e.y1} H ${mx} V ${e.y2} H ${e.x2}`;
  }
  if (e.kind === 'elbow-v') {
    const my = (e.y1 + e.y2) / 2;
    return `M ${e.x1} ${e.y1} V ${my} H ${e.x2} V ${e.y2}`;
  }
  const mx = (e.x1 + e.x2) / 2;
  return `M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`;
}

/** Brace path for a summary, bulging toward the summary node. */
export function summaryPath(s: SummaryDeco): string {
  const tip = s.side === 'right' ? s.x + 16 : s.x - 16;
  const mid = (s.y1 + s.y2) / 2;
  return `M ${s.x} ${s.y1} Q ${tip} ${s.y1}, ${tip} ${mid} Q ${tip} ${s.y2}, ${s.x} ${s.y2}`;
}
