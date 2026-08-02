import { describe, it, expect } from 'vitest';

import {
  addBoundary,
  addChild,
  addFloatingTopic,
  addRelationship,
  addSummary,
  createWorkbook,
  markdownToSheet,
  markdownToWorkbook,
  sheetToMarkdown,
  workbookToMarkdown,
  walkSheetTopics,
  type Sheet,
  type Topic
} from '../src/index.js';

/** Flatten a sheet's root subtree into `depth:title` lines for comparison. */
function outline(sheet: Sheet): string[] {
  const lines: string[] = [];
  const walk = (t: Topic, d: number) => {
    lines.push(`${d}:${t.title}`);
    for (const c of t.children ?? []) walk(c, d + 1);
  };
  walk(sheet.rootTopic, 0);
  return lines;
}

describe('markdown → sheet', () => {
  it('parses headings and nested lists into a tree', () => {
    const md = `# Project
## Research
- Competitors
  - Tool A
  - Tool B
- Interviews
## Build
- Frontend
- Backend
  - API
`;
    const sheet = markdownToSheet(md);
    expect(outline(sheet)).toEqual([
      '0:Project',
      '1:Research',
      '2:Competitors',
      '3:Tool A',
      '3:Tool B',
      '2:Interviews',
      '1:Build',
      '2:Frontend',
      '2:Backend',
      '3:API'
    ]);
  });

  it('reads frontmatter for structure/theme', () => {
    const md = `---
title: Plan
structure: org.down
theme: dark
---
# Plan
## A
`;
    const sheet = markdownToSheet(md);
    expect(sheet.structure).toBe('org.down');
    expect(sheet.theme).toBe('dark');
  });

  it('ignores an unknown structure instead of writing it into the sheet', () => {
    const sheet = markdownToSheet(`---\nstructure: org.sideways\ntheme: dark\n---\n# Plan\n`);
    expect(sheet.structure).toBe('map.balanced');
    expect(sheet.theme).toBe('dark');
  });

  it('is lenient when there is no H1', () => {
    const sheet = markdownToSheet(`- lonely\n- items\n`);
    expect(sheet.rootTopic.title).toBe('Untitled');
    expect(sheet.rootTopic.children?.map((c) => c.title)).toEqual(['lonely', 'items']);
  });

  it('reads sheet settings and background from the frontmatter', () => {
    const md = `---
title: Plan
settings: {"wrapText":false,"branchColor":"#ff0000"}
background: {"color":"#eeeeee"}
---
# Plan
`;
    const sheet = markdownToSheet(md);
    expect(sheet.settings?.wrapText).toBe(false);
    expect(sheet.settings?.branchColor).toBe('#ff0000');
    expect(sheet.background?.color).toBe('#eeeeee');
  });

  it('ignores settings that are not a JSON object instead of failing the import', () => {
    const sheet = markdownToSheet(`---\ntitle: Plan\nsettings: nonsense\n---\n# Plan\n`);
    expect(sheet.settings).toBeUndefined();
    expect(sheet.rootTopic.title).toBe('Plan');
  });

  it('parses per-topic metadata from the trailing comment', () => {
    const md = `# Root
## Task <!-- vmm: {"markers":["priority-1"],"note":"do it","collapsed":true} -->
`;
    const sheet = markdownToSheet(md);
    const task = sheet.rootTopic.children![0]!;
    expect(task.markers).toEqual(['priority-1']);
    expect(task.note?.plain).toBe('do it');
    expect(task.collapsed).toBe(true);
  });

  it('falls back to plaintext title if trailing comment is invalid JSON', () => {
    const md = `# Root\n## Task <!-- vmm: {bad json} -->\n`;
    const sheet = markdownToSheet(md);
    expect(sheet.rootTopic.children![0]!.title).toBe('Task <!-- vmm: {bad json} -->');
  });

  it('appends non-structural text as notes, preserving existing notes', () => {
    const md = `# Root\n## Topic <!-- vmm: {"note":"initial note"} -->\nSome extra text\nAnd more text`;
    const sheet = markdownToSheet(md);
    const topic = sheet.rootTopic.children![0]!;
    expect(topic.note?.plain).toBe('initial note\nSome extra text\nAnd more text');
  });
});


describe('round-trip: sheet → markdown → sheet', () => {
  it('preserves the topic hierarchy', () => {
    const wb = createWorkbook('Root');
    const a = addChild(wb.sheets[0]!.rootTopic, 'A');
    addChild(a, 'A1');
    addChild(a, 'A2');
    const b = addChild(wb.sheets[0]!.rootTopic, 'B');
    addChild(b, 'B1');

    const md = sheetToMarkdown(wb.sheets[0]!);
    const back = markdownToSheet(md);
    expect(outline(back)).toEqual(outline(wb.sheets[0]!));
  });

  it('preserves sheet settings and background', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    sheet.settings = { wrapText: false, compactMap: true, branchLineWidth: 3 };
    sheet.background = { color: '#101010' };

    const back = markdownToSheet(sheetToMarkdown(sheet));
    expect(back.settings).toEqual(sheet.settings);
    expect(back.background).toEqual(sheet.background);
  });

  it('preserves per-topic style, image, and shape', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    addChild(sheet.rootTopic, 'Styled', {
      style: { fillColor: '#ff8800', shape: 'capsule', font: { size: 20, weight: 'bold' } },
      image: { resource: 'resources/logo.png', width: 120, height: 90 },
      structureClass: 'org.down'
    });

    const styled = markdownToSheet(sheetToMarkdown(sheet)).rootTopic.children![0]!;
    expect(styled.style).toEqual({
      fillColor: '#ff8800',
      shape: 'capsule',
      font: { size: 20, weight: 'bold' }
    });
    expect(styled.image).toEqual({ resource: 'resources/logo.png', width: 120, height: 90 });
    expect(styled.structureClass).toBe('org.down');
  });

  it('keeps a rich note and a non-web link, which have no short form', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    addChild(sheet.rootTopic, 'Rich', {
      note: { plain: 'plain text', rich: '<p>plain <b>text</b></p>' },
      hyperlink: { type: 'file', value: 'C:/notes/spec.pdf' }
    });

    const back = markdownToSheet(sheetToMarkdown(sheet)).rootTopic.children![0]!;
    expect(back.note).toEqual({ plain: 'plain text', rich: '<p>plain <b>text</b></p>' });
    expect(back.hyperlink).toEqual({ type: 'file', value: 'C:/notes/spec.pdf' });
  });

  it('preserves relationships, boundaries, and summaries', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    const a = addChild(sheet.rootTopic, 'A');
    const b = addChild(sheet.rootTopic, 'B');
    addRelationship(sheet, a.id, b.id, 'depends on');
    addBoundary(sheet, sheet.rootTopic.id, [a.id, b.id], 'Phase 1');
    addSummary(sheet, sheet.rootTopic.id, [a.id, b.id], 'Both');

    const back = markdownToSheet(sheetToMarkdown(sheet));
    expect(back.relationships).toEqual(sheet.relationships);
    expect(back.boundaries).toEqual(sheet.boundaries);
    expect(back.summaries).toEqual(sheet.summaries);
    // The endpoints only reconnect if their ids survived the trip.
    expect(back.rootTopic.children!.map((c) => c.id)).toEqual([a.id, b.id]);
  });

  it('leaves ids out of a map that has no connectors', () => {
    const wb = createWorkbook('Root');
    addChild(wb.sheets[0]!.rootTopic, 'A');
    expect(sheetToMarkdown(wb.sheets[0]!)).not.toContain('"id"');
  });

  it('preserves floating topics, their positions, and their children', () => {
    const wb = createWorkbook('Root');
    const sheet = wb.sheets[0]!;
    addChild(sheet.rootTopic, 'Branch');
    const parked = addFloatingTopic(sheet, 'Parked idea', { x: 320, y: -80 });
    addChild(parked, 'Detail');

    const back = markdownToSheet(sheetToMarkdown(sheet));
    expect(back.floatingTopics).toHaveLength(1);
    expect(back.floatingTopics![0]!.title).toBe('Parked idea');
    expect(back.floatingTopics![0]!.position).toEqual({ x: 320, y: -80 });
    expect(back.floatingTopics![0]!.children!.map((c) => c.title)).toEqual(['Detail']);
    // The floating section must not leak into the main tree.
    expect(outline(back)).toEqual(['0:Root', '1:Branch']);
  });

  it('re-ids a duplicated topic and drops the connector left pointing nowhere', () => {
    const md = `---
title: Plan
relationships: [{"id":"r-1","end1Id":"t-dup","end2Id":"t-b"}]
---
# Plan
## A <!-- vmm: {"id":"t-dup"} -->
## B <!-- vmm: {"id":"t-dup"} -->
`;
    const sheet = markdownToSheet(md);
    const [a, b] = sheet.rootTopic.children!;
    expect(a!.id).toBe('t-dup');
    expect(b!.id).not.toBe('t-dup');
    // t-b was never in the file, so the relationship goes rather than dangling.
    expect(sheet.relationships ?? []).toEqual([]);
  });

  it('never lets a hand-written comment overwrite the title or children', () => {
    const sheet = markdownToSheet(
      `# Root\n## Real <!-- vmm: {"title":"Fake","children":[{"id":"x","title":"Ghost"}]} -->\n`
    );
    const branch = sheet.rootTopic.children![0]!;
    expect(branch.title).toBe('Real');
    expect(branch.children).toEqual([]);
  });

  it('preserves markers, notes, links, and collapsed state', () => {
    const wb = createWorkbook('Root');
    addChild(wb.sheets[0]!.rootTopic, 'Styled', {
      markers: ['flag-red'],
      labels: ['urgent'],
      note: { plain: 'remember this' },
      collapsed: true,
      hyperlink: { type: 'web', value: 'https://example.com' }
    });

    const md = sheetToMarkdown(wb.sheets[0]!);
    const back = markdownToSheet(md);
    const styled = back.rootTopic.children![0]!;
    expect(styled.markers).toEqual(['flag-red']);
    expect(styled.labels).toEqual(['urgent']);
    expect(styled.note?.plain).toBe('remember this');
    expect(styled.collapsed).toBe(true);
    expect(styled.hyperlink?.value).toBe('https://example.com');
  });
});

describe('workbook ↔ markdown (multi-sheet)', () => {
  it('round-trips multiple sheets via the sheet separator', () => {
    const wb = createWorkbook('Sheet A root');
    wb.sheets.push(markdownToSheet('# Sheet B root\n## child\n'));
    addChild(wb.sheets[0]!.rootTopic, 'a-child');

    const md = workbookToMarkdown(wb);
    const back = markdownToWorkbook(md);
    expect(back.sheets).toHaveLength(2);
    expect(back.sheets[0]!.rootTopic.title).toBe('Sheet A root');
    expect(back.sheets[1]!.rootTopic.title).toBe('Sheet B root');
  });

  it('generates unique ids on import', () => {
    const wb = markdownToWorkbook('# R\n## a\n## b\n');
    const ids = new Set([...walkSheetTopics(wb.sheets[0]!)].map((t) => t.id));
    expect(ids.size).toBe(3);
  });

  it("preserves each sheet's structure across a workbook round-trip", () => {
    const wb = createWorkbook('First');
    wb.sheets[0]!.structure = 'logic.right';
    const second = markdownToSheet('# Second\n## x\n');
    second.structure = 'org.down';
    wb.sheets.push(second);

    const back = markdownToWorkbook(workbookToMarkdown(wb));
    expect(back.sheets.map((s) => s.structure)).toEqual(['logic.right', 'org.down']);
  });
});
