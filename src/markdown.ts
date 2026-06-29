/**
 * Markdown lane (DESIGN.md §4.4, §9) — the bridge LLMs and humans write through.
 *
 * A `.vmm` is the canonical, feature-rich format; Markdown is a *projection* of it.
 * Markdown captures the topic tree plus the handful of per-topic extras that fit
 * cleanly in text (markers, labels, note, collapsed, link). Structure type, styles,
 * relationships, boundaries, summaries, and floating topics are not representable
 * in Markdown and are dropped on export / added in-app after import.
 *
 * Format:
 *   - Optional YAML-ish frontmatter (title / structure / theme).
 *   - `# H1` = central (root) topic.
 *   - `##` = level-1 branches; deeper topics are nested `-` lists.
 *   - The parser is lenient: it also accepts headings or lists at any level.
 *   - Per-topic extras ride in a trailing `<!-- vmm: {json} -->` comment.
 */

import { createSheet, createTopic } from "./model.js";
import type { Sheet, StructureId, Topic, Workbook } from "./types.js";

const SHEET_SEPARATOR = "<!-- vmm:sheet -->";

// ---------------------------------------------------------------------------
// Per-topic metadata carried in a trailing HTML comment
// ---------------------------------------------------------------------------

interface TopicMeta {
  markers?: string[];
  labels?: string[];
  note?: string;
  collapsed?: boolean;
  link?: string;
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
  if (meta.markers?.length) topic.markers = meta.markers;
  if (meta.labels?.length) topic.labels = meta.labels;
  if (meta.note) topic.note = { plain: meta.note };
  if (meta.collapsed) topic.collapsed = true;
  if (meta.link) topic.hyperlink = { type: "web", value: meta.link };
}

function collectMeta(topic: Topic): TopicMeta | undefined {
  const meta: TopicMeta = {};
  if (topic.markers?.length) meta.markers = topic.markers;
  if (topic.labels?.length) meta.labels = topic.labels;
  if (topic.note?.plain) meta.note = topic.note.plain;
  if (topic.collapsed) meta.collapsed = true;
  if (topic.hyperlink?.value) meta.link = topic.hyperlink.value;
  return Object.keys(meta).length ? meta : undefined;
}

function titleWithMeta(topic: Topic): string {
  const meta = collectMeta(topic);
  const title = topic.title.replace(/\r?\n/g, " ");
  return meta ? `${title} <!-- vmm: ${JSON.stringify(meta)} -->` : title;
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

interface Frontmatter {
  title?: string;
  structure?: StructureId;
  theme?: string;
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
    const value = kv[2]!.replace(/^["']|["']$/g, "").trim();
    if (key === "title") fm.title = value;
    else if (key === "structure") fm.structure = value as StructureId;
    else if (key === "theme") fm.theme = value;
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
  const lines = body.split(/\r?\n/);

  let root: Topic | undefined;
  const headingStack: (Topic | undefined)[] = []; // indexed by heading level (1..6)
  let currentHeading: Topic | undefined;
  let listStack: Topic[] = [];

  const ensureRoot = (): Topic => {
    if (!root) {
      root = createTopic(fm.title ?? "Untitled");
      currentHeading = root;
      headingStack[1] = root;
    }
    return root;
  };

  for (const raw of lines) {
    if (!raw.trim()) continue;

    const heading = HEADING_RE.exec(raw);
    if (heading) {
      const level = heading[1]!.length;
      const { title, meta } = splitMeta(heading[2]!);
      const topic = createTopic(title);
      applyMeta(topic, meta);

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
        if (headingStack[l]) { parent = headingStack[l]; break; }
      }
      parent = parent ?? root!;
      (parent.children ??= []).push(topic);
      headingStack.length = level + 1;
      headingStack[level] = topic;
      currentHeading = topic;
      listStack = [];
      continue;
    }

    const list = LIST_RE.exec(raw);
    if (list) {
      ensureRoot();
      const indent = list[1]!.replace(/\t/g, "  ").length;
      const depth = Math.floor(indent / 2);
      const { title, meta } = splitMeta(list[2]!);
      const topic = createTopic(title);
      applyMeta(topic, meta);

      const parent = depth === 0 ? currentHeading ?? root! : listStack[depth - 1] ?? currentHeading ?? root!;
      (parent.children ??= []).push(topic);
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

  const rootTopic = root ?? createTopic(fm.title ?? "Untitled");
  return createSheet(fm.title ?? rootTopic.title, {
    rootTopic,
    structure: fm.structure ?? "map.balanced",
    theme: fm.theme ?? "classic",
  });
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

  if (opts.frontmatter !== false) {
    out.push("---");
    out.push(`title: ${sheet.rootTopic.title.replace(/\r?\n/g, " ")}`);
    out.push(`structure: ${sheet.structure}`);
    out.push(`theme: ${sheet.theme}`);
    out.push("---", "");
  }

  out.push(`# ${titleWithMeta(sheet.rootTopic)}`);

  const emitList = (topic: Topic, depth: number) => {
    for (const child of topic.children ?? []) {
      out.push(`${"  ".repeat(depth)}- ${titleWithMeta(child)}`);
      emitList(child, depth + 1);
    }
  };

  for (const branch of sheet.rootTopic.children ?? []) {
    out.push("", `## ${titleWithMeta(branch)}`);
    emitList(branch, 0);
  }

  return out.join("\n") + "\n";
}

export function workbookToMarkdown(wb: Workbook, opts: ToMarkdownOptions = {}): string {
  return wb.sheets
    .map((s) => sheetToMarkdown(s, opts).trimEnd())
    .join(`\n\n${SHEET_SEPARATOR}\n\n`) + "\n";
}
