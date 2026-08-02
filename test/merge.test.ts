import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  addChild,
  addRelationship,
  createWorkbook,
  findDuplicateIds,
  markdownToWorkbook,
  mergeDocuments,
  newDocument,
  readVmm,
  walkSheetTopics,
  writeVmm,
  type VmmDocument
} from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const rich = () => readVmm(readFileSync(join(here, '..', 'examples', 'rich.vmm')));

/** A one-sheet document whose single branch is related to the root. */
function doc(title: string, resources: Record<string, Uint8Array> = {}): VmmDocument {
  const wb = createWorkbook(title);
  const sheet = wb.sheets[0]!;
  sheet.title = title;
  const branch = addChild(sheet.rootTopic, `${title} branch`);
  addRelationship(sheet, sheet.rootTopic.id, branch.id, 'link');
  return { ...newDocument(wb), resources };
}

describe('mergeDocuments', () => {
  it('gives every sheet of every input its own tab, in order', () => {
    const a = doc('Alpha');
    const b = markdownToWorkbook('# One\n## x\n\n<!-- vmm:sheet -->\n\n# Two\n## y\n');

    const merged = mergeDocuments([a, newDocument(b)]);
    expect(merged.workbook.sheets.map((s) => s.title)).toEqual(['Alpha', 'One', 'Two']);
  });

  it('renames colliding topic ids and moves the connectors with them', () => {
    const original = doc('Same');
    // The realistic collision: a file merged with a copy of itself.
    const merged = mergeDocuments([original, structuredClone(original)]);

    expect(findDuplicateIds(merged.workbook)).toEqual([]);
    const [first, second] = merged.workbook.sheets;
    const idsOf = (s: (typeof merged.workbook.sheets)[number]) =>
      new Set([...walkSheetTopics(s)].map((t) => t.id));
    // Each copy's relationship must point inside its own sheet, not across.
    for (const sheet of [first!, second!]) {
      const ids = idsOf(sheet);
      const rel = sheet.relationships![0]!;
      expect(ids.has(rel.end1Id) && ids.has(rel.end2Id)).toBe(true);
    }
    // Writing is the real proof: the container refuses duplicate ids.
    expect(() => writeVmm(merged.workbook, merged.resources)).not.toThrow();
  });

  it('renames a colliding resource and repoints the topic image at it', () => {
    const png = (b: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, b]);
    const withImage = (title: string, byte: number) => {
      const d = doc(title, { 'resources/img.png': png(byte) });
      d.workbook.sheets[0]!.rootTopic.image = { resource: 'resources/img.png' };
      d.workbook.sheets[0]!.background = { image: 'resources/img.png' };
      return d;
    };

    const merged = mergeDocuments([withImage('A', 1), withImage('B', 2)]);
    const [a, b] = merged.workbook.sheets;
    expect(a!.rootTopic.image!.resource).toBe('resources/img.png');
    expect(b!.rootTopic.image!.resource).toBe('resources/img-2.png');
    expect(b!.background!.image).toBe('resources/img-2.png');
    expect(merged.resources['resources/img.png']).toEqual(png(1));
    expect(merged.resources['resources/img-2.png']).toEqual(png(2));
  });

  it('repoints a topic-to-topic link and an attachment at their renamed targets', () => {
    const original = doc('Linked', { 'resources/spec.pdf': new Uint8Array([1]) });
    const branch = original.workbook.sheets[0]!.rootTopic.children![0]!;
    original.workbook.sheets[0]!.rootTopic.hyperlink = { type: 'topic', value: branch.id };
    branch.attachments = [{ resource: 'resources/spec.pdf', name: 'spec.pdf' }];
    const copy = structuredClone(original);
    copy.resources['resources/spec.pdf'] = new Uint8Array([2]); // same name, other file

    const merged = mergeDocuments([original, copy]);
    const [first, second] = merged.workbook.sheets;
    for (const sheet of [first!, second!]) {
      // The link must land on this sheet's own branch, not the other copy's.
      expect(sheet.rootTopic.hyperlink!.value).toBe(sheet.rootTopic.children![0]!.id);
    }
    expect(first!.rootTopic.children![0]!.attachments![0]!.resource).toBe('resources/spec.pdf');
    expect(second!.rootTopic.children![0]!.attachments![0]!.resource).toBe('resources/spec-2.pdf');
  });

  it('shares one copy when the same path holds the same bytes', () => {
    const png = new Uint8Array([1, 2, 3]);
    const merged = mergeDocuments([
      doc('A', { 'resources/img.png': png }),
      doc('B', { 'resources/img.png': png })
    ]);
    expect(Object.keys(merged.resources)).toEqual(['resources/img.png']);
  });

  it('disambiguates duplicate sheet titles so the tabs can be told apart', () => {
    const merged = mergeDocuments([doc('Plan'), doc('Plan'), doc('Plan')]);
    expect(merged.workbook.sheets.map((s) => s.title)).toEqual(['Plan', 'Plan (2)', 'Plan (3)']);
  });

  it('leaves the inputs untouched', () => {
    const a = doc('A');
    const before = structuredClone(a.workbook);
    mergeDocuments([a, doc('A')]);
    expect(a.workbook).toEqual(before);
  });

  it('merges a real file with itself and still writes a readable .vmm', () => {
    const merged = mergeDocuments([rich(), rich()]);
    const back = readVmm(writeVmm(merged.workbook, merged.resources));
    expect(back.workbook.sheets).toHaveLength(rich().workbook.sheets.length * 2);
    expect(findDuplicateIds(back.workbook)).toEqual([]);
  });
});
