/**
 * Markdown lane (DESIGN.md §4.4, §9) — the bridge LLMs and humans write through.
 *
 * A `.vmm` is the canonical, feature-rich format; Markdown is a *projection* of
 * it — but a complete one. The outline carries the tree; everything the outline
 * has no shape for (per-topic styles and images, relationships, boundaries,
 * summaries, floating topics) rides alongside it as JSON, so an export → edit →
 * import round-trip keeps the map intact instead of stripping it back to text.
 * The one thing Markdown can't carry is image *bytes*: those live in the `.vmm`
 * zip, so a topic image survives as a reference and re-resolves only against
 * the file it came from.
 *
 * Format:
 *   - Optional YAML-ish frontmatter (title / structure / theme / settings /
 *     background / relationships / boundaries / summaries; everything after
 *     `theme` is one line of JSON each).
 *   - `# H1` = central (root) topic.
 *   - `##` = level-1 branches; deeper topics are nested `-` lists.
 *   - The parser is lenient: it also accepts headings or lists at any level.
 *   - Per-topic extras ride in a trailing `<!-- vmm: {json} -->` comment.
 *   - Floating topics follow a `<!-- vmm:floating -->` marker, as `##` headings.
 */

import {
  createSheet,
  createTopic,
  newId,
  pruneDanglingConnectors,
  walkSheetTopics
} from './model.js';
import { isStructureId } from './types.js';
import type {
  Boundary,
  Note,
  Relationship,
  Sheet,
  SheetBackground,
  SheetSettings,
  StructureId,
  Summary,
  Topic,
  Workbook
} from './types.js';

const SHEET_SEPARATOR = '<!-- vmm:sheet -->';
const FLOATING_MARKER = '<!-- vmm:floating -->';

// ---------------------------------------------------------------------------
// Per-topic metadata carried in a trailing HTML comment
// ---------------------------------------------------------------------------

interface TopicMeta {
  id?: string;
  markers?: string[];
  labels?: string[];
  /** Short form of `note.plain`; a note with rich text rides as an object. */
  note?: string | Note;
  collapsed?: boolean;
  /** Short form of a `web` hyperlink; other link types ride as `hyperlink`. */
  link?: string;
  /** Any other topic field (style, image, position, attachments, …). */
  [key: string]: unknown;
}

const META_RE = /\s*<!--\s*vmm:\s*(\{[\s\S]*?\})\s*-->\s*$/;

function splitMeta(text: string): { title: string; meta?: TopicMeta } {
  const m = META_RE.exec(text);
  if (!m) return { title: text.trim() };
  try {
    const meta = JSON.parse(m[1]!) as TopicMeta;
    return { title: text.slice(0, m.index).trim(), meta };
  } catch {
    return { title: text.trim() };
  }
}

function applyMeta(topic: Topic, meta?: TopicMeta): void {
  if (!meta) return;
  // `title` and `children` always come from the outline: taking them from a
  // hand-written comment would let it contradict, or corrupt, the tree.
  const { id, markers, labels, note, collapsed, link, title: _t, children: _c, ...rest } = meta;
  Object.assign(topic, rest);
  if (typeof id === 'string' && id) topic.id = id;
  if (markers?.length) topic.markers = markers;
  if (labels?.length) topic.labels = labels;
  if (typeof note === 'string') topic.note = { plain: note };
  else if (note) topic.note = note;
  if (collapsed) topic.collapsed = true;
  if (link) topic.hyperlink = { type: 'web', value: link };
}

/**
 * Everything on the topic except its title and children, with short readable
 * forms for the common cases. `withId` is set only for topics a connector names,
 * so an ordinary map stays free of id noise.
 */
function collectMeta(topic: Topic, withId: boolean): TopicMeta | undefined {
  const meta: TopicMeta = {};
  const plainNote = !!topic.note?.plain && !topic.note.rich;
  const webLink = topic.hyperlink?.type === 'web' && !!topic.hyperlink.value;

  if (withId) meta.id = topic.id;
  if (topic.markers?.length) meta.markers = topic.markers;
  if (topic.labels?.length) meta.labels = topic.labels;
  if (plainNote) meta.note = topic.note!.plain;
  if (topic.collapsed) meta.collapsed = true;
  if (webLink) meta.link = topic.hyperlink!.value;

  // Whatever is left — style, image, position, attachments, or a field only a
  // newer build knows about — rides verbatim rather than being dropped.
  const handled = new Set([
    'id',
    'title',
    'children',
    'markers',
    'labels',
    'collapsed',
    ...(plainNote ? ['note'] : []),
    ...(webLink ? ['hyperlink'] : [])
  ]);
  for (const [key, value] of Object.entries(topic)) {
    if (handled.has(key) || value == null) continue;
    if (Array.isArray(value) && !value.length) continue;
    meta[key] = value;
  }
  return Object.keys(meta).length ? meta : undefined;
}

function titleWithMeta(topic: Topic, withIds: ReadonlySet<string>): string {
  const meta = collectMeta(topic, withIds.has(topic.id));
  const title = topic.title.replace(/\r?\n/g, ' ');
  return meta ? `${title} <!-- vmm: ${JSON.stringify(meta)} -->` : title;
}

/** Topic ids a connector points at: the only ones worth writing into the text. */
function referencedIds(sheet: Sheet): Set<string> {
  const ids = new Set<string>();
  for (const r of sheet.relationships ?? []) {
    ids.add(r.end1Id);
    ids.add(r.end2Id);
  }
  for (const group of [...(sheet.boundaries ?? []), ...(sheet.summaries ?? [])]) {
    ids.add(group.parentId);
    for (const c of group.childIds) ids.add(c);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

interface Frontmatter {
  title?: string;
  structure?: StructureId;
  theme?: string;
  settings?: SheetSettings;
  background?: SheetBackground;
  relationships?: Relationship[];
  boundaries?: Boundary[];
  summaries?: Summary[];
}

/**
 * A frontmatter value holding JSON, used for the sheet-level blocks that have
 * no readable one-line YAML form. Anything of the wrong shape is ignored rather
 * than fatal, like the rest of the parser: a hand-edited file should still
 * import, minus the block it got wrong.
 */
function jsonOf<T>(value: string, kind: 'object' | 'array'): T | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    const ok =
      kind === 'array'
        ? Array.isArray(parsed)
        : !!parsed && typeof parsed === 'object' && !Array.isArray(parsed);
    return ok ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
}

function parseFrontmatter(md: string): { body: string; fm: Frontmatter } {
  // Tolerate leading blank lines (e.g. a sheet section after the separator).
  const lead = /^\s*\n/.exec(md);
  const text = lead ? md.slice(lead[0].length) : md;
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { body: md, fm: {} };
  const fm: Frontmatter = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (!kv) continue;
    const key = kv[1]!;
    const value = kv[2]!.replace(/^["']|["']$/g, '').trim();
    if (key === 'title') fm.title = value;
    // An unknown structure is ignored, not fatal: the parser is lenient, and the
    // caller falls back to the documented default rather than losing the import.
    else if (key === 'structure' && isStructureId(value)) fm.structure = value;
    else if (key === 'theme') fm.theme = value;
    else if (key === 'settings') fm.settings = jsonOf<SheetSettings>(value, 'object');
    else if (key === 'background') fm.background = jsonOf<SheetBackground>(value, 'object');
    else if (key === 'relationships') fm.relationships = jsonOf<Relationship[]>(value, 'array');
    else if (key === 'boundaries') fm.boundaries = jsonOf<Boundary[]>(value, 'array');
    else if (key === 'summaries') fm.summaries = jsonOf<Summary[]>(value, 'array');
  }
  return { body: text.slice(m[0].length), fm };
}

// ---------------------------------------------------------------------------
// Parse: Markdown → Sheet / Workbook
// ---------------------------------------------------------------------------

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const LIST_RE = /^(\s*)[-*]\s+(.*)$/;

export function markdownToSheet(md: string): Sheet {
  const { body, fm } = parseFrontmatter(md);
  // Floating topics live after the marker, as headings of their own; parsing
  // them is the same job, so it reuses this function under a throwaway root.
  const [mainBody = '', ...floatParts] = body.split(FLOATING_MARKER);
  const lines = mainBody.split(/\r?\n/);

  let root: Topic | undefined;
  const headingStack: (Topic | undefined)[] = []; // indexed by heading level (1..6)
  let currentHeading: Topic | undefined;
  let listStack: Topic[] = [];

  const ensureRoot = (): Topic => {
    if (!root) {
      root = createTopic(fm.title ?? 'Untitled');
      currentHeading = root;
      headingStack[1] = root;
    }
    return root;
  };

  const makeTopic = (text: string): Topic => {
    const { title, meta } = splitMeta(text);
    const topic = createTopic(title);
    applyMeta(topic, meta);
    return topic;
  };

  for (const raw of lines) {
    if (!raw.trim()) continue;

    const heading = HEADING_RE.exec(raw);
    if (heading) {
      const level = heading[1]!.length;
      const topic = makeTopic(heading[2]!);

      if (level === 1 && !root) {
        root = topic;
        headingStack.length = 0;
        headingStack[1] = topic;
        currentHeading = topic;
        listStack = [];
        continue;
      }

      ensureRoot();
      let parent: Topic | undefined;
      for (let l = level - 1; l >= 1; l--) {
        if (headingStack[l]) {
          parent = headingStack[l];
          break;
        }
      }
      parent = parent ?? root!;
      parent.children ??= [];
      parent.children.push(topic);
      headingStack.length = level + 1;
      headingStack[level] = topic;
      currentHeading = topic;
      listStack = [];
      continue;
    }

    const list = LIST_RE.exec(raw);
    if (list) {
      ensureRoot();
      const indent = list[1]!.replace(/\t/g, '  ').length;
      const depth = Math.floor(indent / 2);
      const topic = makeTopic(list[2]!);

      const parent =
        depth === 0 ? (currentHeading ?? root!) : (listStack[depth - 1] ?? currentHeading ?? root!);
      parent.children ??= [];
      parent.children.push(topic);
      listStack.length = depth + 1;
      listStack[depth] = topic;
      continue;
    }

    // Non-structural line: append as a note to the most recent topic.
    const target = listStack[listStack.length - 1] ?? currentHeading ?? root;
    if (target) {
      const existing = target.note?.plain;
      target.note = { plain: existing ? `${existing}\n${raw.trim()}` : raw.trim() };
    }
  }

  const rootTopic = root ?? createTopic(fm.title ?? 'Untitled');
  const floatingTopics = floatParts.length
    ? markdownToSheet(`# floating\n${floatParts.join('\n')}`).rootTopic.children
    : undefined;

  const sheet = createSheet(fm.title ?? rootTopic.title, {
    rootTopic,
    structure: fm.structure ?? 'map.balanced',
    theme: fm.theme ?? 'classic',
    ...(fm.settings ? { settings: fm.settings } : {}),
    ...(fm.background ? { background: fm.background } : {}),
    ...(floatingTopics?.length ? { floatingTopics } : {}),
    ...(fm.relationships?.length ? { relationships: fm.relationships } : {}),
    ...(fm.boundaries?.length ? { boundaries: fm.boundaries } : {}),
    ...(fm.summaries?.length ? { summaries: fm.summaries } : {})
  });

  // Ids come from the text now, so the text can repeat one — copy a topic in an
  // editor and you have two. Writing that out would be refused by the container,
  // so the later copy gets a fresh id and any connector left pointing nowhere is
  // dropped (which also covers a hand-written id that matches no topic).
  const seen = new Set<string>();
  for (const t of walkSheetTopics(sheet)) {
    if (seen.has(t.id)) t.id = newId('t');
    seen.add(t.id);
  }
  pruneDanglingConnectors(sheet);
  return sheet;
}

export function markdownToWorkbook(md: string): Workbook {
  const parts = md.split(new RegExp(`\\r?\\n${SHEET_SEPARATOR}\\r?\\n`)).filter((p) => p.trim());
  const sheets = (parts.length ? parts : [md]).map(markdownToSheet);
  return { id: `wb-${Date.now().toString(36)}`, sheets };
}

// ---------------------------------------------------------------------------
// Serialize: Sheet / Workbook → Markdown
// ---------------------------------------------------------------------------

export interface ToMarkdownOptions {
  /** Emit YAML frontmatter (default true). */
  frontmatter?: boolean;
}

export function sheetToMarkdown(sheet: Sheet, opts: ToMarkdownOptions = {}): string {
  const out: string[] = [];
  const ids = referencedIds(sheet);

  if (opts.frontmatter !== false) {
    out.push('---');
    out.push(`title: ${sheet.rootTopic.title.replace(/\r?\n/g, ' ')}`);
    out.push(`structure: ${sheet.structure}`);
    out.push(`theme: ${sheet.theme}`);
    // Sheet-level blocks ride as one line of JSON each: settings are a flat bag
    // of flags with no fixed key set, and connectors are pure id references with
    // no readable outline form. A per-key YAML mapping would need its own reader
    // and would still lose anything a newer build added.
    if (sheet.settings && Object.keys(sheet.settings).length) {
      out.push(`settings: ${JSON.stringify(sheet.settings)}`);
    }
    if (sheet.background && Object.keys(sheet.background).length) {
      out.push(`background: ${JSON.stringify(sheet.background)}`);
    }
    if (sheet.relationships?.length) {
      out.push(`relationships: ${JSON.stringify(sheet.relationships)}`);
    }
    if (sheet.boundaries?.length) out.push(`boundaries: ${JSON.stringify(sheet.boundaries)}`);
    if (sheet.summaries?.length) out.push(`summaries: ${JSON.stringify(sheet.summaries)}`);
    out.push('---', '');
  }

  out.push(`# ${titleWithMeta(sheet.rootTopic, ids)}`);

  const emitList = (topic: Topic, depth: number) => {
    for (const child of topic.children ?? []) {
      out.push(`${'  '.repeat(depth)}- ${titleWithMeta(child, ids)}`);
      emitList(child, depth + 1);
    }
  };

  for (const branch of sheet.rootTopic.children ?? []) {
    out.push('', `## ${titleWithMeta(branch, ids)}`);
    emitList(branch, 0);
  }

  // Floating topics are real content, so they stay readable below the map
  // rather than disappearing into the frontmatter; their canvas position rides
  // in the same per-topic comment as everything else.
  if (sheet.floatingTopics?.length) {
    out.push('', FLOATING_MARKER);
    for (const floating of sheet.floatingTopics) {
      out.push('', `## ${titleWithMeta(floating, ids)}`);
      emitList(floating, 0);
    }
  }

  return out.join('\n') + '\n';
}

export function workbookToMarkdown(wb: Workbook, opts: ToMarkdownOptions = {}): string {
  return (
    wb.sheets.map((s) => sheetToMarkdown(s, opts).trimEnd()).join(`\n\n${SHEET_SEPARATOR}\n\n`) +
    '\n'
  );
}
