import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { addChild, createWorkbook, readVmm } from '../src/index.js';
import { layoutBalanced, layoutSheet, edgePath, sizeOf } from '../app/src/lib/layout.js';

const here = dirname(fileURLToPath(import.meta.url));
const examples = join(here, '..', 'examples');

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

  it('uses continuous indigo underlines for the text-on-lines map', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    sheet.structure = 'map.underline';
    const number = addChild(sheet.rootTopic, '1');
    const label = addChild(number, 'Gratitude');
    addChild(label, 'A daily practice');

    const layout = layoutSheet(sheet);
    // The first link is a curved join plus the first topic's underline; every
    // deeper link continues the shared underline.
    expect(layout.edges).toHaveLength(4);
    expect(layout.edges.filter((e) => e.kind === 'bezier')).toHaveLength(1);
    expect(layout.edges.filter((e) => e.kind === 'straight')).toHaveLength(1);
    expect(layout.edges.filter((e) => e.kind === 'underline')).toHaveLength(2);
    expect(layout.edges.every((e) => e.color === '#4f46d4')).toBe(true);
    expect(edgePath(layout.edges.find((e) => e.kind === 'underline')!)).toMatch(/^M .* V .* H /);
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
    expect(layout.edges.some((e) => e.kind === 'underline')).toBe(true);
  });

  it('lays out the rich example without errors', () => {
    const bytes = readFileSync(join(examples, 'rich.vmm'));
    const { workbook } = readVmm(bytes);
    const layout = layoutBalanced(workbook.sheets[0]!);
    expect(layout.nodes.length).toBeGreaterThan(3);
    expect(edgePath(layout.edges[0]!)).toMatch(/^M /);
  });
});
