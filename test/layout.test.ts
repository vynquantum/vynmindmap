import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { addChild, createWorkbook, readVmm, STRUCTURE_IDS } from '../src/index.js';
import type { Topic } from '../src/index.js';
import {
  layoutBalanced,
  layoutSheet,
  edgePath,
  escapeOverlap,
  sizeOf,
  titleAnchor,
  touches,
  viewRect
} from '../app/src/lib/layout.js';
import { isBoxedLevelOne } from '../app/src/lib/mapAppearance.js';

const here = dirname(fileURLToPath(import.meta.url));
const examples = join(here, '..', 'examples');

/** One chart type per layout family, so a family that draws its own geometry
 * can't quietly stop honoring the structure-independent extras. */
const EVERY_FAMILY = [
  'map.balanced',
  'logic.right',
  'org.down',
  'tree.right',
  'timeline.h',
  'fishbone.right',
  'matrix',
  'tree-table',
  'grid',
  'brace.right'
] as const;

describe('layoutBalanced', () => {
  it('produces a node per visible topic and an edge per parent-child link', () => {
    const wb = createWorkbook('Root');
    const root = wb.sheets[0]!.rootTopic;
    const a = addChild(root, 'A');
    addChild(root, 'B');
    addChild(a, 'A1');

    const layout = layoutBalanced(wb.sheets[0]!);
    // root + A + B + A1 = 4 nodes
    expect(layout.nodes).toHaveLength(4);
    // root→A, root→B, A→A1 = 3 edges
    expect(layout.edges).toHaveLength(3);
  });

  it('keeps all coordinates within the reported canvas size, margins included', () => {
    const wb = createWorkbook('Root');
    for (let i = 0; i < 8; i++) addChild(wb.sheets[0]!.rootTopic, `Branch ${i}`);
    const layout = layoutBalanced(wb.sheets[0]!);
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(layout.width);
      expect(n.y + n.h).toBeLessThanOrEqual(layout.height);
    }
  });

  it('splits children to both sides (balanced)', () => {
    const wb = createWorkbook('Root');
    for (let i = 0; i < 6; i++) addChild(wb.sheets[0]!.rootTopic, `n${i}`);
    const layout = layoutBalanced(wb.sheets[0]!);
    const sides = new Set(layout.nodes.filter((n) => n.depth === 1).map((n) => n.side));
    expect(sides).toContain('left');
    expect(sides).toContain('right');
  });

  it('hides children of a collapsed topic', () => {
    const wb = createWorkbook('Root');
    const a = addChild(wb.sheets[0]!.rootTopic, 'A');
    addChild(a, 'hidden');
    a.collapsed = true;
    const layout = layoutBalanced(wb.sheets[0]!);
    expect(layout.nodes.find((n) => n.topic.title === 'hidden')).toBeUndefined();
    expect(layout.nodes.find((n) => n.id === a.id)!.hasHiddenChildren).toBe(true);
  });

  it('wraps long titles and grows the node instead of overflowing', () => {
    const short = sizeOf({ id: 'a', title: 'Hi', children: [] });
    const long = sizeOf({
      id: 'b',
      title:
        'A very long topic title that must wrap across several lines instead of overflowing the box',
      children: []
    });
    expect(short.lines).toHaveLength(1);
    expect(long.lines.length).toBeGreaterThan(1);
    expect(long.w).toBeLessThanOrEqual(260);
    expect(long.h).toBeGreaterThan(short.h);
    // Explicit newlines become separate lines too.
    expect(sizeOf({ id: 'c', title: 'one\ntwo', children: [] }).lines).toEqual(['one', 'two']);
  });

  it('honors an explicit width and minimum height for text wrapping', () => {
    const topic = {
      id: 'sized',
      title: 'A longer title that should wrap at the selected width',
      children: [],
      style: { width: 120, minHeight: 100 }
    };
    const sized = sizeOf(topic);
    expect(sized.w).toBe(120);
    expect(sized.h).toBeGreaterThanOrEqual(100);
    expect(sized.lines.length).toBeGreaterThan(1);

    const wider = sizeOf({ ...topic, style: { width: 400 } });
    expect(wider.w).toBe(400);
    expect(wider.lines.length).toBeLessThan(sized.lines.length);
  });

  it('keeps multi-line siblings from overlapping vertically', () => {
    const wb = createWorkbook('Root');
    const root = wb.sheets[0]!.rootTopic;
    addChild(
      root,
      'A very long topic title that must wrap across several lines to get tall enough'
    );
    addChild(root, 'Second');
    wb.sheets[0]!.structure = 'map.right';
    const layout = layoutSheet(wb.sheets[0]!);
    const kids = layout.nodes.filter((n) => n.depth === 1).sort((a, b) => a.y - b.y);
    expect(kids[0]!.y + kids[0]!.h).toBeLessThanOrEqual(kids[1]!.y);
  });

  it('honors the sheet branch style for mind-map edges', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    sheet.structure = 'map.balanced';
    addChild(sheet.rootTopic, 'A');
    addChild(sheet.rootTopic, 'B');

    expect(layoutSheet(sheet).edges.every((e) => e.kind === 'bezier')).toBe(true);
    sheet.settings = { branchStyle: 'straight' };
    expect(layoutSheet(sheet).edges.every((e) => e.kind === 'straight')).toBe(true);
    sheet.settings.branchStyle = 'elbow';
    expect(layoutSheet(sheet).edges.every((e) => e.kind === 'elbow-h')).toBe(true);
    // Each family keeps its own default but honors an explicit style.
    sheet.structure = 'logic.right';
    delete sheet.settings.branchStyle;
    expect(layoutSheet(sheet).edges.every((e) => e.kind === 'elbow-h')).toBe(true);
    sheet.settings.branchStyle = 'curve';
    expect(layoutSheet(sheet).edges.every((e) => e.kind === 'bezier')).toBe(true);
    // Vertical charts support straight diagonals and otherwise stay elbowed.
    sheet.structure = 'org.down';
    expect(layoutSheet(sheet).edges.every((e) => e.kind === 'elbow-v')).toBe(true);
    sheet.settings.branchStyle = 'straight';
    expect(layoutSheet(sheet).edges.every((e) => e.kind === 'straight')).toBe(true);
  });

  it('lays out the grid structure as non-overlapping cards with separators', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    sheet.structure = 'grid';
    for (let i = 0; i < 5; i++) {
      const c = addChild(sheet.rootTopic, `Section ${i}`);
      addChild(c, `Item ${i}`);
    }

    const layout = layoutSheet(sheet);
    expect(layout.nodes).toHaveLength(11);
    // 5 cells → 3 columns → 2 column separators.
    expect(layout.gridLines).toHaveLength(2);
    const headers = layout.nodes.filter((n) => n.depth === 1);
    for (const a of headers) {
      for (const b of headers) {
        if (a === b) continue;
        const overlaps = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('draws the text-on-lines map as curved joins plus flat underlines', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    sheet.structure = 'map.underline';
    const number = addChild(sheet.rootTopic, '1');
    const label = addChild(number, 'Gratitude');
    addChild(label, 'A daily practice');

    const layout = layoutSheet(sheet);
    // Every link is a curved join off the parent's line plus the child's own
    // underline — no right-angle steps at any depth.
    expect(layout.edges).toHaveLength(6);
    expect(layout.edges.filter((e) => e.kind === 'bezier')).toHaveLength(3);
    const lines = layout.edges.filter((e) => e.id.endsWith('-line'));
    expect(lines).toHaveLength(3);
    expect(lines.every((e) => e.kind === 'straight' && e.y1 === e.y2)).toBe(true);
    expect(layout.edges.every((e) => edgePath(e).startsWith('M'))).toBe(true);

    // The treatment reshapes connectors; it does not recolor them. Each branch
    // keeps its palette color, and an explicit topic line color still wins.
    const palette = new Set(layout.nodes.filter((n) => n.depth > 0).map((n) => n.color));
    expect(layout.edges.every((e) => palette.has(e.color))).toBe(true);
    label.style = { lineColor: '#ff0000' };
    const intoLabel = layoutSheet(sheet).edges.filter((e) => e.id.includes(`->${label.id}`));
    expect(intoLabel).toHaveLength(2);
    expect(intoLabel.every((e) => e.color === '#ff0000')).toBe(true);
  });

  it('keeps the chart type when the text-on-lines treatment is applied', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    sheet.structure = 'map.balanced';
    sheet.settings = { mapPresentation: 'underline' };
    for (let i = 0; i < 4; i++) addChild(addChild(sheet.rootTopic, `B${i}`), `leaf ${i}`);

    const layout = layoutSheet(sheet);
    // Balanced stays balanced: the treatment only replaces the connectors.
    const sides = new Set(layout.nodes.filter((n) => n.depth === 1).map((n) => n.side));
    expect(sides).toEqual(new Set(['left', 'right']));

    // Left-side underlines mirror: they run outward, away from the root.
    const root = layout.nodes.find((n) => n.depth === 0)!;
    const lines = layout.edges.filter((e) => e.id.endsWith('-line'));
    expect(lines.length).toBeGreaterThan(0);
    for (const e of lines) {
      if (e.x1 < root.x) expect(e.x2).toBeLessThan(e.x1);
      else expect(e.x2).toBeGreaterThan(e.x1);
    }

    // Chart types that draw their own geometry ignore the treatment.
    sheet.structure = 'org.down';
    expect(layoutSheet(sheet).edges.every((e) => !e.id.endsWith('-line'))).toBe(true);
  });

  it('keeps chart type, map presentation, and color controls independent', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    sheet.structure = 'map.right';
    sheet.theme = 'ocean';
    sheet.settings = {
      mapPresentation: 'underline',
      coloredBranches: false,
      branchColor: '#123456',
      branchLineWidth: 4
    };
    const a = addChild(sheet.rootTopic, 'A');
    addChild(a, 'A detail');

    const layout = layoutSheet(sheet);
    expect(layout.nodes.find((n) => n.depth === 0)!.color).toBe('#075985');
    expect(layout.edges.every((e) => e.color === '#123456' && e.width === 4)).toBe(true);
    expect(layout.edges.some((e) => e.id.endsWith('-line'))).toBe(true);
  });

  it('draws boundaries and summaries in every chart type, not just the tree-like ones', () => {
    for (const structure of EVERY_FAMILY) {
      const wb = createWorkbook('Root');
      const sheet = wb.sheets[0]!;
      sheet.structure = structure;
      const a = addChild(sheet.rootTopic, 'A');
      const b = addChild(sheet.rootTopic, 'B');
      const parentId = sheet.rootTopic.id;
      sheet.boundaries = [{ id: 'bd', parentId, childIds: [a.id, b.id], title: 'Scope' }];
      sheet.summaries = [
        {
          id: 'sm',
          parentId,
          childIds: [a.id, b.id],
          summaryTopic: { id: 'sum', title: 'Total', children: [] }
        }
      ];

      const layout = layoutSheet(sheet);
      expect(layout.boundaries, structure).toHaveLength(1);
      expect(layout.summaries, structure).toHaveLength(1);
      expect(
        layout.nodes.map((n) => n.id),
        structure
      ).toContain('sum');
    }
  });

  it('places floating topics in every chart type, not just the tree-like ones', () => {
    for (const structure of EVERY_FAMILY) {
      const wb = createWorkbook('Root');
      const sheet = wb.sheets[0]!;
      sheet.structure = structure;
      addChild(sheet.rootTopic, 'Branch');
      const note = { id: 'float-1', title: 'Parking lot', children: [] as Topic[] };
      note.children.push({ id: 'float-2', title: 'Later idea', children: [] });
      sheet.floatingTopics = [note];

      const layout = layoutSheet(sheet);
      const ids = layout.nodes.map((n) => n.id);
      expect(ids, structure).toContain('float-1');
      expect(ids, structure).toContain('float-2');
      // The floating subtree brings its own connector whatever the chart draws.
      expect(
        layout.edges.some((e) => e.id.includes('float-1') && e.id.includes('float-2')),
        structure
      ).toBe(true);
    }
  });

  it('places every topic of the tree, in every structure', () => {
    const ids = (t: Topic): string[] => [t.id, ...(t.children ?? []).flatMap(ids)];

    for (const structure of STRUCTURE_IDS) {
      const wb = createWorkbook('Root');
      const sheet = wb.sheets[0]!;
      sheet.structure = structure;
      const a = addChild(sheet.rootTopic, 'A');
      const b = addChild(sheet.rootTopic, 'B');
      const a1 = addChild(a, 'A1');
      addChild(a, 'A2');
      addChild(b, 'B1');
      // Depth 3 — a layout that walks a fixed number of levels drops this one.
      const deep = addChild(a1, 'A1x');

      const placed = new Set(layoutSheet(sheet).nodes.map((n) => n.id));
      const missing = ids(sheet.rootTopic).filter((id) => !placed.has(id));

      // BACKLOG.md §1: fishbone iterates exactly two levels (bones, then causes),
      // so depth 3 is placed nowhere. Drop this branch when sub-bones land.
      if (structure.startsWith('fishbone.')) expect(missing, structure).toEqual([deep.id]);
      else expect(missing, structure).toEqual([]);
    }
  });

  it('lays out the rich example without errors', () => {
    const bytes = readFileSync(join(examples, 'rich.vmm'));
    const { workbook } = readVmm(bytes);
    const layout = layoutBalanced(workbook.sheets[0]!);
    expect(layout.nodes.length).toBeGreaterThan(3);
    expect(edgePath(layout.edges[0]!)).toMatch(/^M /);
  });
});

describe('map display settings', () => {
  /** Root with two children, one of them much wider than the other. */
  function sample() {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    const narrow = addChild(sheet.rootTopic, 'Hi');
    const wide = addChild(sheet.rootTopic, 'A considerably longer branch title');
    return { sheet, narrow, wide };
  }

  it('compacts the gaps between topics and between levels', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    sheet.structure = 'map.right';
    // Stacked siblings, each with a child, so both gaps are load-bearing.
    for (const t of ['One', 'Two', 'Three']) addChild(addChild(sheet.rootTopic, t), 'leaf');

    const spread = layoutSheet(sheet);
    sheet.settings = { compactMap: true };
    const tight = layoutSheet(sheet);

    expect(tight.height).toBeLessThan(spread.height); // row gap
    expect(tight.width).toBeLessThan(spread.width); // level gap
    // Spacing only: the topics themselves are untouched.
    expect(tight.nodes.map((n) => n.w)).toEqual(spread.nodes.map((n) => n.w));
  });

  it('widens every topic to the widest one, and only while enabled', () => {
    const { sheet, narrow, wide } = sample();
    const natural = new Map(layoutSheet(sheet).nodes.map((n) => [n.id, n.w]));
    expect(natural.get(narrow.id)).toBeLessThan(natural.get(wide.id)!);

    sheet.settings = { uniformTopicLength: true };
    const widths = new Set(layoutSheet(sheet).nodes.map((n) => n.w));
    expect(widths.size).toBe(1);
    expect([...widths][0]).toBe(natural.get(wide.id));

    // The knob is module state, so a later layout must not inherit it — nor
    // feed the previous uniform width back in as a new natural width.
    sheet.settings = {};
    const after = new Map(layoutSheet(sheet).nodes.map((n) => [n.id, n.w]));
    expect(after.get(narrow.id)).toBe(natural.get(narrow.id));
  });

  it('grows a topic to fit its note only when notes are displayed', () => {
    const { sheet, narrow } = sample();
    narrow.note = { plain: 'A note long enough to wrap onto more than one line in the box.' };
    const plain = layoutSheet(sheet).nodes.find((n) => n.id === narrow.id)!;
    expect(plain.noteLines).toEqual([]);

    sheet.settings = { displayAllNotes: true };
    const shown = layoutSheet(sheet).nodes.find((n) => n.id === narrow.id)!;
    expect(shown.noteLines.length).toBeGreaterThan(1);
    // Reserved room, so a note can never spill over the topic below it.
    expect(shown.h).toBeGreaterThan(plain.h);
  });

  it('keeps a long title on one line, and widens the topic, when wrapping is off', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    const title = 'A branch title long enough that it has to wrap onto several lines';
    const long = addChild(sheet.rootTopic, title);
    const lay = () => layoutSheet(sheet).nodes.find((n) => n.id === long.id)!;

    const wrapped = lay();
    expect(wrapped.lines.length).toBeGreaterThan(1);

    sheet.settings = { wrapText: false };
    const flat = lay();
    expect(flat.lines).toHaveLength(1);
    expect(flat.w).toBeGreaterThan(wrapped.w);
    expect(flat.h).toBeLessThan(wrapped.h);

    // Typed line breaks are the user's own, so they still break.
    long.title = 'two\nlines';
    expect(lay().lines).toEqual(['two', 'lines']);

    // Module state again: a later layout must not inherit the knob.
    long.title = title;
    sheet.settings = {};
    expect(lay().lines).toEqual(wrapped.lines);
  });

  it('colors floating topics from the palette only when asked', () => {
    const { sheet } = sample();
    sheet.floatingTopics = [{ id: 'f1', title: 'One', children: [] } as Topic];
    const gray = layoutSheet(sheet).nodes.find((n) => n.id === 'f1')!.color;

    sheet.settings = { autoColorFloating: true };
    const colored = layoutSheet(sheet).nodes.find((n) => n.id === 'f1')!.color;
    expect(colored).not.toBe(gray);
    // The same palette the first branch uses, so the two read as one scheme.
    expect(colored).toBe(layoutSheet(sheet).nodes.find((n) => n.depth === 1)!.color);
  });
});

describe('free branch position', () => {
  it('moves the whole subtree to the anchor and leaves the connector attached', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    const branch = addChild(sheet.rootTopic, 'Branch');
    const leaf = addChild(branch, 'Leaf');
    const auto = layoutSheet(sheet);
    const gap = {
      x:
        auto.nodes.find((n) => n.id === leaf.id)!.x - auto.nodes.find((n) => n.id === branch.id)!.x,
      y: auto.nodes.find((n) => n.id === leaf.id)!.y - auto.nodes.find((n) => n.id === branch.id)!.y
    };

    branch.position = { x: 400, y: -300 };
    // Ignored until the option is on, so a stale position can't move a branch.
    const off = layoutSheet(sheet);
    expect(off.nodes.find((n) => n.id === branch.id)!.x).toBe(
      auto.nodes.find((n) => n.id === branch.id)!.x
    );

    sheet.settings = { freeBranchPosition: true };
    const on = layoutSheet(sheet);
    const movedBranch = on.nodes.find((n) => n.id === branch.id)!;
    const movedLeaf = on.nodes.find((n) => n.id === leaf.id)!;
    // Normalization shifts the whole map, so check the branch's own shape held.
    expect(movedLeaf.x - movedBranch.x).toBeCloseTo(gap.x);
    expect(movedLeaf.y - movedBranch.y).toBeCloseTo(gap.y);
    // Still a child, so the parent-child connector is still drawn.
    expect(on.edges.some((e) => e.id.includes(branch.id))).toBe(true);
    expect(movedBranch.floating).toBeFalsy();
  });
});

describe('boxed first level', () => {
  it('only applies on top of the text-on-lines treatment', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    sheet.settings = { boxedLevelOne: true };
    // Boxed presentation already draws every topic in a box, so the option has
    // nothing to add and must not report itself as active.
    expect(isBoxedLevelOne(sheet)).toBe(false);

    sheet.settings.mapPresentation = 'underline';
    expect(isBoxedLevelOne(sheet)).toBe(true);

    // A chart type that draws its own geometry ignores the treatment entirely.
    sheet.structure = 'org.down';
    expect(isBoxedLevelOne(sheet)).toBe(false);
  });

  it('places floating topics at the depth the option boxes', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    const child = addChild(sheet.rootTopic, 'Branch');
    sheet.floatingTopics = [{ id: 'park', title: 'Parking lot', children: [] } as Topic];

    const byId = new Map(layoutSheet(sheet).nodes.map((n) => [n.id, n.depth]));
    expect(byId.get(child.id)).toBe(1);
    // Floating topics read as first-level branches, so they pick up the same
    // box rather than being singled out as bare text.
    expect(byId.get('park')).toBe(1);
  });
});

/** Whether two placed rectangles share any area. */
function overlaps(a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe('topic overlap', () => {
  const obstacle = { x: 0, y: 0, w: 100, h: 40 };

  it('leaves a box that already clears everything where it is', () => {
    expect(escapeOverlap({ x: 500, y: 500, w: 80, h: 30 }, [obstacle])).toEqual({ x: 500, y: 500 });
  });

  it('escapes along the axis that needs the least movement', () => {
    // Deep inside horizontally, barely inside vertically: down is the short way.
    const moved = escapeOverlap({ x: 20, y: 35, w: 100, h: 40 }, [obstacle]);
    expect(moved.x).toBe(20);
    expect(moved.y).toBeGreaterThanOrEqual(obstacle.y + obstacle.h);
  });

  it('walks clear of a stacked row instead of bouncing between two of them', () => {
    const box = { x: 10, y: 10, w: 60, h: 30 };
    const row = [obstacle, { x: 0, y: 48, w: 100, h: 40 }, { x: 0, y: 96, w: 100, h: 40 }];
    const moved = escapeOverlap(box, row);
    expect(row.some((o) => overlaps({ ...moved, w: box.w, h: box.h }, o))).toBe(false);
  });
});

describe('flexible floating topic', () => {
  it('shifts a floating topic off the main map', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    addChild(sheet.rootTopic, 'Branch');
    const float: Topic = {
      id: 'park',
      title: 'Parking lot',
      children: [],
      position: { x: 0, y: 0 }
    };
    sheet.floatingTopics = [float];

    // Aim the floating topic at the root: positions are shift-free, so lining
    // up the two local origins stacks them whatever the map's final offset is.
    const probe = layoutSheet(sheet);
    const pRoot = probe.nodes.find((n) => n.id === sheet.rootTopic.id)!;
    const pFloat = probe.nodes.find((n) => n.id === 'park')!;
    float.position = { x: pRoot.x - pFloat.x, y: pRoot.y - pFloat.y };

    const off = layoutSheet(sheet);
    const rect = (l: typeof off, id: string) => {
      const n = l.nodes.find((m) => m.id === id)!;
      return { x: n.x, y: n.y, w: n.w, h: n.h };
    };
    expect(overlaps(rect(off, sheet.rootTopic.id), rect(off, 'park'))).toBe(true);

    sheet.settings = { flexibleFloatingTopic: true };
    const on = layoutSheet(sheet);
    expect(overlaps(rect(on, sheet.rootTopic.id), rect(on, 'park'))).toBe(false);
  });
});

describe('title alignment', () => {
  it('anchors inside the box, symmetrically, and centres by default', () => {
    const w = 200;
    const left = titleAnchor('left', w);
    const right = titleAnchor('right', w);
    const centre = titleAnchor('center', w);

    expect(left).toEqual({ anchor: 'start', x: 13 });
    expect(right).toEqual({ anchor: 'end', x: w - 13 });
    expect(centre).toEqual({ anchor: 'middle', x: w / 2 });
    // An unset align is centred, so existing maps render exactly as before.
    expect(titleAnchor(undefined, w)).toEqual(centre);

    // Text drawn on a line hugs the end the line starts from, so siblings that
    // share a left edge but not a width start their titles at the same x.
    expect(titleAnchor(undefined, w, 'left')).toEqual(left);
    expect(titleAnchor(undefined, 300, 'left').x).toBe(left.x);
    expect(titleAnchor(undefined, w, 'right')).toEqual(right);
    // An explicit align still wins over the fallback.
    expect(titleAnchor('center', w, 'left')).toEqual(centre);

    // Both insets have to match the padding sizeOf reserved, or a fixed-width
    // topic wraps its text at one width and then paints it at another.
    expect(left.x).toBe(w - right.x);
    const t: Topic = { id: 'a', title: 'x'.repeat(40), style: { width: w } };
    expect(sizeOf(t).w).toBe(w);
  });
});

describe('viewport culling', () => {
  // A wide map: 60 branches spread far enough that most sit off screen.
  const wb = createWorkbook('Root');
  const root = wb.sheets[0]!.rootTopic;
  for (let i = 0; i < 60; i++) {
    const b = addChild(root, `Branch ${i}`);
    for (let j = 0; j < 4; j++) addChild(b, `Leaf ${i}.${j}`);
  }
  const layout = layoutSheet(wb.sheets[0]!);
  const seen = (view: ReturnType<typeof viewRect>) => layout.nodes.filter((n) => touches(view, n));

  it('keeps what the viewport shows and drops the rest', () => {
    // Top-left corner of the map at 1:1, in a small window.
    const view = viewRect(0, 0, 1, 800, 600);
    const kept = seen(view);
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(layout.nodes.length);
    // Nothing kept is fully outside the padded view, nothing dropped is inside.
    for (const n of layout.nodes) {
      const inside =
        n.x < view.x + view.w && n.x + n.w > view.x && n.y < view.y + view.h && n.y + n.h > view.y;
      expect(kept.includes(n)).toBe(inside);
    }
  });

  it('pads the view, so a small pan reveals boxes that are already drawn', () => {
    // A node just past the right edge is still built, thanks to the padding.
    const view = viewRect(0, 0, 1, 800, 600);
    expect(view.x).toBeLessThan(0);
    expect(touches(view, { x: 900, y: 100, w: 20, h: 20 })).toBe(true);
    expect(touches(view, { x: 2000, y: 100, w: 20, h: 20 })).toBe(false);
  });

  it('shows the whole map when it is zoomed to fit', () => {
    const s = Math.min(800 / layout.width, 600 / layout.height);
    expect(seen(viewRect(0, 0, s, 800, 600)).length).toBe(layout.nodes.length);
  });

  it('follows the pan transform', () => {
    // Panning far right must surface nodes the initial view had dropped.
    const first = seen(viewRect(0, 0, 1, 800, 600));
    const later = seen(viewRect(800 - layout.width, 600 - layout.height, 1, 800, 600));
    expect(later.some((n) => !first.includes(n))).toBe(true);
  });
});
