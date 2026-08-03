import { describe, it, expect } from 'vitest';

import {
  addBoundary,
  addChild,
  addFloatingTopic,
  addSheet,
  cloneTopicWithNewIds,
  collapseToLevel,
  insertParent,
  walkTopic,
  addRelationship,
  addSibling,
  addSummary,
  createWorkbook,
  deleteTopic,
  detachTopic,
  findDuplicateIds,
  ensureIds,
  findTopic,
  ModelError,
  moveTopic,
  removeBoundary,
  removeRelationship,
  removeSummary,
  setStructure,
  toggleCollapse,
  walkSheetTopics,
  type Sheet
} from '../src/index.js';

function fixture(): { sheet: Sheet } {
  const wb = createWorkbook('Root');
  const sheet = wb.sheets[0]!;
  const a = addChild(sheet.rootTopic, 'A');
  addChild(a, 'A1');
  addChild(a, 'A2');
  addChild(sheet.rootTopic, 'B');
  return { sheet };
}

describe('tree mutations', () => {
  it('adds children and siblings in order', () => {
    const { sheet } = fixture();
    const a = findTopic(sheet, sheet.rootTopic.children![0]!.id)!;
    addSibling(sheet, a.children![0]!.id, 'A1.5');
    expect(a.children!.map((c) => c.title)).toEqual(['A1', 'A1.5', 'A2']);
  });

  it('refuses a sibling on a root', () => {
    const { sheet } = fixture();
    expect(() => addSibling(sheet, sheet.rootTopic.id, 'X')).toThrow(ModelError);
  });

  it('puts a sibling before the given one when asked', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    addSibling(sheet, a.children![1]!.id, 'A1.5', {}, true);
    expect(a.children!.map((c) => c.title)).toEqual(['A1', 'A1.5', 'A2']);
  });

  it('inserts a parent above a topic, keeping its place and its subtree', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const mid = insertParent(sheet, a.id, 'Middle');
    expect(sheet.rootTopic.children!.map((c) => c.title)).toEqual(['Middle', 'B']);
    expect(mid.children).toEqual([a]);
    expect(a.children!.map((c) => c.title)).toEqual(['A1', 'A2']);
  });

  it('refuses to insert a parent above a root', () => {
    const { sheet } = fixture();
    expect(() => insertParent(sheet, sheet.rootTopic.id, 'X')).toThrow(ModelError);
  });

  it('folds the sheet to a level, leaving the root open', () => {
    const { sheet } = fixture();
    const floating = addFloatingTopic(sheet, 'Parked', { x: 0, y: 0 });
    addChild(addChild(floating, 'Detail'), 'Sub-detail');
    const collapsed = () =>
      [...walkSheetTopics(sheet)].filter((t) => t.collapsed).map((t) => t.title);

    // A floating topic is a peer of the central one, so its own branches count
    // as level 1 too. Childless topics (B, A1, A2) are never marked collapsed.
    collapseToLevel(sheet, 1);
    expect(collapsed()).toEqual(['A', 'Detail']);
    collapseToLevel(sheet, 2);
    expect(collapsed()).toEqual([]);
  });

  it('generates unique ids across the workbook', () => {
    const wb = createWorkbook('Root');
    for (let i = 0; i < 50; i++) addChild(wb.sheets[0]!.rootTopic, `n${i}`);
    expect(findDuplicateIds(wb)).toEqual([]);
  });

  it('toggles collapse', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    expect(toggleCollapse(a)).toBe(true);
    expect(toggleCollapse(a)).toBe(false);
  });
});

describe('tree queries & construction', () => {
  it('returns undefined when findTopic cannot find the id', () => {
    const { sheet } = fixture();
    expect(findTopic(sheet, 'non-existent')).toBeUndefined();
  });

  it('addSheet creates and appends a new sheet', () => {
    const wb = createWorkbook('Root');
    const sheet2 = addSheet(wb, 'Sheet 2', 'org.down');
    expect(wb.sheets).toHaveLength(2);
    expect(sheet2.title).toBe('Sheet 2');
    expect(sheet2.structure).toBe('org.down');
  });

  it('ensureIds assigns fresh ids to topics missing them', () => {
    const wb = createWorkbook('Root');
    const a = addChild(wb.sheets[0]!.rootTopic, 'A');
    delete (a as any).id;
    expect(a.id).toBeUndefined();
    ensureIds(wb);
    expect(typeof a.id).toBe('string');
  });

  it('setStructure updates the structure', () => {
    const { sheet } = fixture();
    setStructure(sheet, 'org.down');
    expect(sheet.structure).toBe('org.down');
  });
});

describe('move', () => {
  it('reparents a topic', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const b = sheet.rootTopic.children![1]!;
    const a1 = a.children![0]!;
    moveTopic(sheet, a1.id, b.id);
    expect(a.children!.map((c) => c.title)).toEqual(['A2']);
    expect(b.children!.map((c) => c.title)).toEqual(['A1']);
  });

  it('inserts at an index', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const b = sheet.rootTopic.children![1]!;
    moveTopic(sheet, b.id, a.id, 1);
    expect(a.children!.map((c) => c.title)).toEqual(['A1', 'B', 'A2']);
  });

  it('rejects moving a node into its own subtree', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const a1 = a.children![0]!;
    expect(() => moveTopic(sheet, a.id, a1.id)).toThrow(/itself or its own descendant/);
  });
});

describe('delete', () => {
  it('removes a subtree', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    deleteTopic(sheet, a.id);
    expect(sheet.rootTopic.children!.map((c) => c.title)).toEqual(['B']);
  });

  it('refuses to delete the central root', () => {
    const { sheet } = fixture();
    expect(() => deleteTopic(sheet, sheet.rootTopic.id)).toThrow(/central root/);
  });

  it('prunes relationships referencing a deleted topic', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const b = sheet.rootTopic.children![1]!;
    addRelationship(sheet, a.id, b.id, 'link');
    expect(sheet.relationships).toHaveLength(1);
    deleteTopic(sheet, a.id);
    expect(sheet.relationships).toHaveLength(0);
  });
});

describe('connectors & groupings', () => {
  it('rejects relationships with a missing endpoint', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    expect(() => addRelationship(sheet, a.id, 'nope')).toThrow(ModelError);
  });

  it('requires contiguous children for a boundary', () => {
    const { sheet } = fixture();
    const root = sheet.rootTopic;
    const c = addChild(root, 'C'); // root now has A, B, C
    const a = root.children![0]!;
    // A and C are not contiguous (B is between them).
    expect(() => addBoundary(sheet, root.id, [a.id, c.id])).toThrow(/contiguous/);
  });

  it('rejects a boundary/summary if a child is not a direct child of the parent', () => {
    const { sheet } = fixture();
    const root = sheet.rootTopic;
    const a = root.children![0]!;
    const a1 = a.children![0]!;
    // a1 is a grandchild of root, not a direct child
    expect(() => addBoundary(sheet, root.id, [a.id, a1.id])).toThrow(/direct children/);
  });

  it('removes relationships, boundaries, and summaries by id', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const b = sheet.rootTopic.children![1]!;
    const rel = addRelationship(sheet, a.id, b.id);
    const ids = a.children!.map((c) => c.id);
    const bnd = addBoundary(sheet, a.id, ids);
    const sum = addSummary(sheet, a.id, ids, 'sum');
    expect(removeRelationship(sheet, rel.id)).toBe(true);
    expect(removeBoundary(sheet, bnd.id)).toBe(true);
    expect(removeSummary(sheet, sum.id)).toBe(true);
    expect(sheet.relationships).toHaveLength(0);
    expect(sheet.boundaries).toHaveLength(0);
    expect(sheet.summaries).toHaveLength(0);
  });

  it('accepts a contiguous boundary and a summary', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const ids = a.children!.map((c) => c.id);
    expect(() => addBoundary(sheet, a.id, ids, 'grp')).not.toThrow();
    const summary = addSummary(sheet, a.id, ids, 'sum');
    // The summary topic should be discoverable in the sheet walk.
    const allIds = [...walkSheetTopics(sheet)].map((t) => t.id);
    expect(allIds).toContain(summary.summaryTopic.id);
  });
});

describe('cloneTopicWithNewIds', () => {
  it('deep-copies the subtree with fresh ids everywhere', () => {
    const wb = createWorkbook('Root');
    const root = wb.sheets[0]!.rootTopic;
    const a = addChild(root, 'A', { markers: ['star'] });
    const a1 = addChild(a, 'A1');
    addChild(a1, 'A1a');

    const clone = cloneTopicWithNewIds(a);

    // Same shape and content…
    expect([...walkTopic(clone)].map((t) => t.title)).toEqual(
      [...walkTopic(a)].map((t) => t.title)
    );
    expect(clone.markers).toEqual(['star']);

    // …but no id collides with the original subtree.
    const origIds = new Set([...walkTopic(a)].map((t) => t.id));
    for (const t of walkTopic(clone)) expect(origIds.has(t.id)).toBe(false);

    // Pasting the clone back keeps the workbook free of duplicate ids.
    root.children!.push(clone);
    expect(findDuplicateIds(wb)).toEqual([]);
  });

  it('does not mutate the source topic', () => {
    const wb = createWorkbook('Root');
    const a = addChild(wb.sheets[0]!.rootTopic, 'A');
    const before = a.id;
    cloneTopicWithNewIds(a);
    expect(a.id).toBe(before);
  });
});

describe('detach & reattach', () => {
  it('detaches a topic into a floating topic at a position', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const detached = detachTopic(sheet, a.id, { x: 100, y: 50 });
    expect(sheet.rootTopic.children!.map((c) => c.title)).toEqual(['B']);
    expect(sheet.floatingTopics?.map((t) => t.id)).toContain(a.id);
    expect(detached.position).toEqual({ x: 100, y: 50 });
    // Subtree comes along.
    expect(detached.children!.map((c) => c.title)).toEqual(['A1', 'A2']);
  });

  it('detaches into a sheet that has no floatingTopics array yet', () => {
    // Stands in for a Svelte $state sheet: what the object ends up holding is
    // not the value the assignment expression handed back. So
    // `(sheet.floatingTopics ??= []).push(t)` pushes into a stray array and the
    // topic is lost — removed from its parent and filed nowhere. (Svelte gets
    // there by keeping its own tracked container rather than by copying, but
    // the effect on a write that bypasses it is the same.)
    const wrap = <T extends object>(o: T): T =>
      new Proxy(o, {
        set(t, k, v) {
          Reflect.set(t, k, Array.isArray(v) ? wrap([...v]) : v);
          return true;
        }
      });
    const { sheet } = fixture();
    delete sheet.floatingTopics;
    const proxied = wrap(sheet);
    const a = proxied.rootTopic.children![0]!;
    detachTopic(proxied, a.id, { x: 10, y: 20 });
    expect(proxied.floatingTopics?.map((t) => t.id)).toEqual([a.id]);
  });

  it('refuses to detach the central root or a floating topic', () => {
    const { sheet } = fixture();
    expect(() => detachTopic(sheet, sheet.rootTopic.id, { x: 0, y: 0 })).toThrow(ModelError);
    const a = sheet.rootTopic.children![0]!;
    detachTopic(sheet, a.id, { x: 0, y: 0 });
    expect(() => detachTopic(sheet, a.id, { x: 0, y: 0 })).toThrow(ModelError);
  });

  it('drops boundaries/summaries that referenced the detached topic', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    addBoundary(sheet, sheet.rootTopic.id, [a.id]);
    addSummary(sheet, sheet.rootTopic.id, [a.id], 'sum');
    detachTopic(sheet, a.id, { x: 0, y: 0 });
    expect(sheet.boundaries).toHaveLength(0);
    expect(sheet.summaries).toHaveLength(0);
  });

  it('moveTopic reattaches a floating topic under a parent', () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    detachTopic(sheet, a.id, { x: 100, y: 50 });
    const b = sheet.rootTopic.children![0]!; // B is now the only child
    moveTopic(sheet, a.id, b.id);
    expect(sheet.floatingTopics ?? []).toHaveLength(0);
    expect(b.children!.map((c) => c.id)).toContain(a.id);
    expect(a.position).toBeUndefined(); // auto-layout again
  });

  it('still refuses to move the central root', () => {
    const { sheet } = fixture();
    const b = sheet.rootTopic.children![1]!;
    expect(() => moveTopic(sheet, sheet.rootTopic.id, b.id)).toThrow(/central root/);
  });
});
