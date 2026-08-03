import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

import {
  documentFromFile,
  ImportError,
  opmlToWorkbook,
  walkSheetTopics,
  writeVmm,
  xmindToDocument
} from '../src/index.js';

/** A minimal .xmind: content.json plus one image, the way XMind writes it. */
function xmindBytes(content: unknown, extra: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({ 'content.json': strToU8(JSON.stringify(content)), ...extra });
}

const SHEET = {
  id: 'sheet1',
  class: 'sheet',
  title: 'Plan',
  rootTopic: {
    id: 'root',
    title: 'Central',
    structureClass: 'org.xmind.ui.logic.right',
    children: {
      attached: [
        {
          id: 'a',
          title: 'A',
          branch: 'folded',
          labels: ['urgent'],
          markers: [{ markerId: 'flag-red' }],
          href: 'https://example.com',
          notes: { plain: { content: 'a note' } },
          style: { properties: { 'svg:fill': '#ff0000', 'fo:font-size': '14pt' } }
        },
        { id: 'b', title: 'B', image: { src: 'xap:resources/pic.png', width: 40, height: 30 } },
        { id: 'c', title: 'C' }
      ],
      detached: [{ id: 'f', title: 'Floating', position: { x: 200, y: -80 } }],
      summary: [{ id: 'sumtopic', title: 'Both' }]
    },
    boundaries: [{ id: 'bd', range: '(0,1)', title: 'First two' }],
    summaries: [{ id: 'sm', range: '(1,2)', topicId: 'sumtopic' }]
  },
  relationships: [{ id: 'rel', end1Id: 'a', end2Id: 'c', title: 'blocks' }]
};

describe('xmind import', () => {
  const doc = xmindToDocument(
    xmindBytes([SHEET], { 'resources/pic.png': new Uint8Array([1, 2, 3]) })
  );
  const sheet = doc.workbook.sheets[0]!;
  const byTitle = (t: string) => [...walkSheetTopics(sheet)].find((x) => x.title === t)!;

  it('reads the sheet, its structure and its tree', () => {
    expect(sheet.title).toBe('Plan');
    expect(sheet.structure).toBe('logic.right');
    expect(sheet.rootTopic.children?.map((c) => c.title)).toEqual(['A', 'B', 'C']);
  });

  it('carries the details of a topic across', () => {
    const a = byTitle('A');
    expect(a.collapsed).toBe(true);
    expect(a.labels).toEqual(['urgent']);
    expect(a.markers).toEqual(['flag-red']);
    expect(a.note?.plain).toBe('a note');
    expect(a.hyperlink).toEqual({ type: 'web', value: 'https://example.com' });
    expect(a.style?.fillColor).toBe('#ff0000');
    expect(a.style?.font?.size).toBe(14);
  });

  it('keeps images with their bytes', () => {
    expect(byTitle('B').image?.resource).toBe('resources/pic.png');
    expect(doc.resources['resources/pic.png']).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('moves detached topics to the sheet as floating topics', () => {
    expect(sheet.floatingTopics?.map((f) => f.title)).toEqual(['Floating']);
    expect(sheet.floatingTopics?.[0]?.position).toEqual({ x: 200, y: -80 });
  });

  it('repoints relationships, boundaries and summaries at the new ids', () => {
    const ids = new Map([...walkSheetTopics(sheet)].map((t) => [t.title, t.id]));
    expect(sheet.relationships?.[0]).toMatchObject({
      end1Id: ids.get('A'),
      end2Id: ids.get('C'),
      title: 'blocks'
    });
    expect(sheet.boundaries?.[0]).toMatchObject({
      parentId: sheet.rootTopic.id,
      childIds: [ids.get('A'), ids.get('B')],
      title: 'First two'
    });
    expect(sheet.summaries?.[0]).toMatchObject({
      parentId: sheet.rootTopic.id,
      childIds: [ids.get('B'), ids.get('C')]
    });
    expect(sheet.summaries?.[0]?.summaryTopic.title).toBe('Both');
  });

  it('mints fresh ids, so ids from the other app can never collide', () => {
    expect([...walkSheetTopics(sheet)].some((t) => t.id === 'root')).toBe(false);
  });

  it('explains an XMind 8 file instead of failing obscurely', () => {
    const legacy = zipSync({ 'content.xml': strToU8('<xmap-content/>') });
    expect(() => xmindToDocument(legacy)).toThrow(ImportError);
    expect(() => xmindToDocument(legacy)).toThrow(/XMind 8 or older/);
  });

  it('rejects bytes that are not a zip at all', () => {
    expect(() => xmindToDocument(strToU8('hello'))).toThrow(ImportError);
  });
});

describe('opml import', () => {
  const OPML = `<?xml version="1.0"?>
<opml version="2.0">
  <head><title>Reading list</title></head>
  <body>
    <outline text="Books &amp; more">
      <outline text="Fiction" _note="borrow first"/>
      <outline text="Non-fiction" url="https://example.com/nf">
        <outline text="History"/>
      </outline>
    </outline>
  </body>
</opml>`;

  it('nests the outline and decodes entities', () => {
    const sheet = opmlToWorkbook(OPML).sheets[0]!;
    expect(sheet.title).toBe('Reading list');
    expect(sheet.rootTopic.title).toBe('Books & more');
    expect(sheet.rootTopic.children?.map((c) => c.title)).toEqual(['Fiction', 'Non-fiction']);
    expect(sheet.rootTopic.children?.[1]?.children?.[0]?.title).toBe('History');
  });

  it('keeps notes and links', () => {
    const root = opmlToWorkbook(OPML).sheets[0]!.rootTopic;
    expect(root.children?.[0]?.note?.plain).toBe('borrow first');
    expect(root.children?.[1]?.hyperlink?.value).toBe('https://example.com/nf');
  });

  it('gives several top-level outlines a root of their own', () => {
    const root = opmlToWorkbook(
      '<opml><head><title>Two</title></head><body><outline text="A"/><outline text="B"/></body></opml>'
    ).sheets[0]!.rootTopic;
    expect(root.title).toBe('Two');
    expect(root.children?.map((c) => c.title)).toEqual(['A', 'B']);
  });

  it('refuses a file that is not an outline', () => {
    expect(() => opmlToWorkbook('<html><body>nope</body></html>')).toThrow(ImportError);
    expect(() => opmlToWorkbook('<opml><body></body></opml>')).toThrow(/no topics/);
  });
});

describe('documentFromFile', () => {
  it('picks the reader from the extension', () => {
    expect(
      documentFromFile('a.md', strToU8('# Root\n\n## Child\n')).workbook.sheets[0]!.rootTopic.title
    ).toBe('Root');
    expect(
      documentFromFile('a.opml', strToU8('<opml><body><outline text="Hi"/></body></opml>')).workbook
        .sheets[0]!.rootTopic.title
    ).toBe('Hi');
    expect(documentFromFile('a.xmind', xmindBytes([SHEET])).workbook.sheets[0]!.title).toBe('Plan');
    const vmm = documentFromFile(
      'a.vmm',
      writeVmm(
        opmlToWorkbook(
          '<opml><head><title>T</title></head><body><outline text="Hi"/></body></opml>'
        )
      )
    );
    expect(vmm.workbook.sheets[0]!.rootTopic.title).toBe('Hi');
  });
});
