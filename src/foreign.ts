/**
 * Import maps written by other applications.
 *
 * Two lanes, both read-only — VynMM saves everything as `.vmm` or Markdown:
 *
 *   `.xmind`  ZIP with a `content.json` (XMind 2020 and later)
 *   `.opml`   the outline interchange XML most outliners can write
 *
 * Anything we don't understand is dropped rather than guessed at, and every
 * topic gets a fresh VynMM id so ids from the other app can never collide.
 */

import { unzipSync, strFromU8 } from 'fflate';

import { newId } from './model.js';
import { newDocument } from './vmm.js';
import { markdownToWorkbook } from './markdown.js';
import { readVmm } from './vmm.js';
import {
  isStructureId,
  type Boundary,
  type Relationship,
  type Sheet,
  type StructureId,
  type Summary,
  type Topic,
  type TopicStyle,
  type VmmDocument,
  type Workbook
} from './types.js';

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

type Json = Record<string, unknown>;

const obj = (v: unknown): Json | undefined =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : undefined;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

// ---------------------------------------------------------------------------
// .xmind
// ---------------------------------------------------------------------------

/**
 * XMind's structure ids onto ours. Matched by substring, longest family first:
 * every id starts with `org.xmind.ui.`, and the plain mind maps ("map.
 * clockwise", "map.unbalanced") must be tried last so they don't swallow the
 * others.
 */
const XMIND_STRUCTURES: [string, StructureId][] = [
  ['logic.right', 'logic.right'],
  ['logic.left', 'logic.left'],
  ['org-chart.down', 'org.down'],
  ['org-chart.up', 'org.up'],
  ['tree.right', 'tree.right'],
  ['tree.left', 'tree.left'],
  ['timeline.horizontal', 'timeline.h'],
  ['timeline.vertical', 'timeline.v'],
  ['fishbone.rightHeaded', 'fishbone.right'],
  ['fishbone.leftHeaded', 'fishbone.left'],
  ['spreadsheet', 'tree-table'],
  ['brace.right', 'brace.right'],
  ['brace.left', 'brace.left'],
  ['map', 'map.balanced']
];

function xmindStructure(cls: unknown): StructureId | undefined {
  const s = str(cls);
  if (!s) return undefined;
  if (isStructureId(s)) return s; // already one of ours
  return XMIND_STRUCTURES.find(([key]) => s.includes(key))?.[1];
}

/** XMind keeps style as CSS-ish property strings; take the ones we can draw. */
function xmindStyle(raw: unknown): TopicStyle | undefined {
  const props = obj(obj(raw)?.properties);
  if (!props) return undefined;
  const style: TopicStyle = {};
  const fill = str(props['svg:fill']);
  if (fill) style.fillColor = fill;
  const border = str(props['border-line-color']);
  if (border) style.borderColor = border;
  const line = str(props['line-color']);
  if (line) style.lineColor = line;
  const color = str(props['fo:color']);
  const family = str(props['fo:font-family']);
  const size = str(props['fo:font-size']); // e.g. "14pt"
  const weight = str(props['fo:font-weight']);
  const fontStyle = str(props['fo:font-style']);
  if (color || family || size || weight || fontStyle) {
    style.font = {
      ...(color ? { color } : {}),
      ...(family ? { family } : {}),
      ...(size && parseFloat(size) ? { size: Math.round(parseFloat(size)) } : {}),
      ...(weight === 'bold' ? { weight: 'bold' as const } : {}),
      ...(fontStyle === 'italic' ? { style: 'italic' as const } : {})
    };
  }
  return Object.keys(style).length ? style : undefined;
}

/** "(0,2)" → the child indexes 0,1,2 that a boundary or summary spans. */
function rangeIndexes(range: unknown, childCount: number): number[] {
  const m = /(-?\d+)\s*,\s*(-?\d+)/.exec(str(range) ?? '');
  if (!m) return [];
  const from = Math.max(0, parseInt(m[1]!, 10));
  const to = Math.min(childCount - 1, parseInt(m[2]!, 10));
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

/**
 * One XMind topic and its subtree. Collects the sheet-level connectors it
 * carries (boundaries, summaries) into `sheet` as it goes, and records the
 * old id → new id mapping so relationships can be repointed afterwards.
 */
function xmindTopic(
  raw: Json,
  ids: Map<string, string>,
  boundaries: Boundary[],
  summaries: Summary[]
): Topic {
  const topic: Topic = { id: newId('t'), title: str(raw.title) ?? '' };
  const oldId = str(raw.id);
  if (oldId) ids.set(oldId, topic.id);

  const structure = xmindStructure(raw.structureClass);
  if (structure) topic.structureClass = structure;
  if (raw.branch === 'folded') topic.collapsed = true;

  const pos = obj(raw.position);
  if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
    topic.position = { x: pos.x, y: pos.y };
  }

  const style = xmindStyle(raw.style);
  if (style) topic.style = style;

  const plain = str(obj(obj(raw.notes)?.plain)?.content);
  const rich = str(obj(obj(raw.notes)?.html)?.content ?? obj(obj(raw.notes)?.realHTML)?.content);
  if (plain || rich) topic.note = { plain: plain ?? '', ...(rich ? { rich } : {}) };

  const labels = arr(raw.labels).filter((l): l is string => typeof l === 'string');
  if (labels.length) topic.labels = labels;

  // Markers keep their ids: ours use the same names, and one we don't know
  // draws as a neutral dot rather than disappearing.
  const markers = arr(raw.markers)
    .map((m) => str(obj(m)?.markerId))
    .filter((m): m is string => !!m);
  if (markers.length) topic.markers = markers;

  const href = str(raw.href);
  if (href) {
    topic.hyperlink = {
      type: href.startsWith('mailto:')
        ? 'email'
        : href.startsWith('file:')
          ? 'file'
          : href.startsWith('xmind:')
            ? 'topic'
            : 'web',
      value: href
    };
  }

  // Images live in the zip; "xap:resources/x.png" is XMind's way of spelling
  // the same resources/ folder a .vmm uses.
  const image = obj(raw.image);
  const src = str(image?.src);
  if (src) {
    topic.image = {
      resource: src.replace(/^xap:/, ''),
      ...(typeof image?.width === 'number' ? { width: image.width } : {}),
      ...(typeof image?.height === 'number' ? { height: image.height } : {})
    };
  }

  const children = obj(raw.children);
  const attached = arr(children?.attached)
    .map((c) => obj(c))
    .filter((c): c is Json => !!c);
  if (attached.length) {
    topic.children = attached.map((c) => xmindTopic(c, ids, boundaries, summaries));
  }

  for (const b of arr(raw.boundaries)) {
    const rb = obj(b);
    if (!rb) continue;
    const idx = rangeIndexes(rb.range, topic.children?.length ?? 0);
    if (!idx.length) continue;
    boundaries.push({
      id: newId('b'),
      parentId: topic.id,
      childIds: idx.map((i) => topic.children![i]!.id),
      ...(str(rb.title) ? { title: str(rb.title)! } : {})
    });
  }

  const summaryTopics = new Map<string, Json>();
  for (const s of arr(children?.summary)) {
    const rs = obj(s);
    const id = str(rs?.id);
    if (rs && id) summaryTopics.set(id, rs);
  }
  for (const s of arr(raw.summaries)) {
    const rs = obj(s);
    if (!rs) continue;
    const idx = rangeIndexes(rs.range, topic.children?.length ?? 0);
    const src2 = summaryTopics.get(str(rs.topicId) ?? '');
    if (!idx.length || !src2) continue;
    summaries.push({
      id: newId('s'),
      parentId: topic.id,
      childIds: idx.map((i) => topic.children![i]!.id),
      summaryTopic: xmindTopic(src2, ids, boundaries, summaries)
    });
  }

  return topic;
}

function xmindSheet(raw: Json, index: number): Sheet {
  const ids = new Map<string, string>();
  const boundaries: Boundary[] = [];
  const summaries: Summary[] = [];
  const root = obj(raw.rootTopic) ?? {};
  const rootTopic = xmindTopic(root, ids, boundaries, summaries);

  // XMind hangs floating topics off the root as "detached" children; a .vmm
  // keeps them on the sheet, which is also where the editor expects them.
  const floating = arr(obj(root.children)?.detached)
    .map((c) => obj(c))
    .filter((c): c is Json => !!c)
    .map((c) => xmindTopic(c, ids, boundaries, summaries));

  const relationships: Relationship[] = [];
  for (const r of arr(raw.relationships)) {
    const rr = obj(r);
    const end1 = ids.get(str(rr?.end1Id) ?? '');
    const end2 = ids.get(str(rr?.end2Id) ?? '');
    if (!end1 || !end2) continue; // an end we didn't import: drop the line
    relationships.push({
      id: newId('r'),
      end1Id: end1,
      end2Id: end2,
      ...(str(rr!.title) ? { title: str(rr!.title)! } : {})
    });
  }

  return {
    id: newId('sheet'),
    title: str(raw.title) || `Sheet ${index + 1}`,
    structure: xmindStructure(root.structureClass) ?? 'map.balanced',
    theme: 'default',
    rootTopic,
    ...(floating.length ? { floatingTopics: floating } : {}),
    ...(relationships.length ? { relationships } : {}),
    ...(boundaries.length ? { boundaries } : {}),
    ...(summaries.length ? { summaries } : {})
  };
}

/** Read an `.xmind` file (XMind 2020+) into a document, images included. */
export function xmindToDocument(bytes: Uint8Array): VmmDocument {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (e) {
    throw new ImportError(`Not a valid .xmind file: ${(e as Error).message}`);
  }

  const content = entries['content.json'];
  if (!content) {
    throw new ImportError(
      entries['content.xml']
        ? 'This .xmind was written by XMind 8 or older (content.xml). Open it in a ' +
            'current XMind and save it again, or export it as OPML or Markdown.'
        : 'This .xmind has no content.json.'
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(strFromU8(content));
  } catch (e) {
    throw new ImportError(`content.json is not valid JSON: ${(e as Error).message}`);
  }

  const sheets = arr(raw)
    .map((s) => obj(s))
    .filter((s): s is Json => !!s)
    .map(xmindSheet);
  if (!sheets.length) throw new ImportError('This .xmind has no sheets.');

  const resources: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(entries)) {
    if (path.startsWith('resources/')) resources[path] = data;
  }

  const doc = newDocument({ id: newId('wb'), sheets });
  return { ...doc, resources };
}

// ---------------------------------------------------------------------------
// .opml
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
};

function decodeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out[m[1]!.toLowerCase()] = decodeXml(m[2] ?? m[3] ?? '');
  }
  return out;
}

/**
 * Parse an OPML outline into a workbook.
 *
 * ponytail: a tag scanner, not an XML parser — OPML is a flat vocabulary of
 * `<outline>` elements with quoted attributes, and every writer emits it that
 * way. CDATA sections and comments containing `<outline` would confuse it; if
 * one ever turns up, swap this for a real parser rather than patching regexes.
 */
export function opmlToWorkbook(xml: string): Workbook {
  if (!/<opml[\s>]/i.test(xml) && !/<outline[\s/>]/i.test(xml)) {
    throw new ImportError('This file has no OPML outline in it.');
  }

  const title = decodeXml(/<title>([\s\S]*?)<\/title>/i.exec(xml)?.[1]?.trim() ?? '') || 'Outline';
  const roots: Topic[] = [];
  const stack: Topic[] = [];

  for (const m of xml.matchAll(/<outline\b([^>]*?)(\/?)>|<\/outline\s*>/gi)) {
    if (m[0].startsWith('</')) {
      stack.pop();
      continue;
    }
    const a = attrs(m[1] ?? '');
    const topic: Topic = { id: newId('t'), title: a.text ?? a.title ?? '' };
    const note = a._note ?? a.note;
    if (note) topic.note = { plain: note };
    const url = a.url ?? a.xmlurl ?? a.htmlurl;
    if (url) topic.hyperlink = { type: url.startsWith('mailto:') ? 'email' : 'web', value: url };

    const parent = stack[stack.length - 1];
    if (parent) (parent.children ??= []).push(topic);
    else roots.push(topic);
    if (!m[2]) stack.push(topic); // not self-closing: children follow
  }

  if (!roots.length) throw new ImportError('This OPML file has no topics.');
  // A single root outline is the central topic; several are branches of one
  // named after the file, which is what the outline's own title says.
  const rootTopic = roots.length === 1 ? roots[0]! : { id: newId('t'), title, children: roots };

  return {
    id: newId('wb'),
    sheets: [
      {
        id: newId('sheet'),
        title,
        structure: 'map.balanced',
        theme: 'default',
        rootTopic
      }
    ]
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Read any file VynMM can open, picked by extension: `.vmm`, Markdown,
 * `.xmind` or `.opml`. One place so the app, the drop target and the CLI all
 * accept the same set.
 */
export function documentFromFile(name: string, bytes: Uint8Array): VmmDocument {
  if (/\.(md|markdown|txt)$/i.test(name)) {
    return newDocument(markdownToWorkbook(strFromU8(bytes)));
  }
  if (/\.opml$/i.test(name)) return newDocument(opmlToWorkbook(strFromU8(bytes)));
  if (/\.xmind$/i.test(name)) return xmindToDocument(bytes);
  return readVmm(bytes);
}
