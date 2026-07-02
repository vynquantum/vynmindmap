/**
 * Core model construction, traversal, and mutation operations (DESIGN.md §6).
 *
 * Both the GUI and the AI tooling call these. Mutations are performed in place on
 * a `Workbook`; callers own snapshotting/undo. Every operation keeps ids unique
 * and the tree well-formed.
 */

import {
  type Boundary,
  type Relationship,
  type Sheet,
  type StructureId,
  type Summary,
  type Topic,
  type Workbook,
} from "./types.js";

// ---------------------------------------------------------------------------
// Id generation
// ---------------------------------------------------------------------------

/**
 * Stable, URL-safe unique id. Uses crypto.randomUUID where available (Node 19+,
 * modern browsers / Tauri webview) and falls back to a random string otherwise.
 */
export function newId(prefix = "id"): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const uuid =
    g.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createTopic(title: string, partial: Partial<Topic> = {}): Topic {
  return { id: newId("t"), title, children: [], ...partial };
}

export function createSheet(title: string, partial: Partial<Sheet> = {}): Sheet {
  const structure: StructureId = partial.structure ?? "map.balanced";
  return {
    id: newId("sheet"),
    title,
    structure,
    theme: partial.theme ?? "classic",
    rootTopic: partial.rootTopic ?? createTopic(title),
    ...partial,
  };
}

export function createWorkbook(rootTitle = "Central Topic"): Workbook {
  return { id: newId("wb"), sheets: [createSheet("Sheet 1", { rootTopic: createTopic(rootTitle) })] };
}

// ---------------------------------------------------------------------------
// Traversal
// ---------------------------------------------------------------------------

/** Every topic in a sheet: root subtree, floating subtrees, and summary topics. */
export function* walkSheetTopics(sheet: Sheet): Generator<Topic> {
  yield* walkTopic(sheet.rootTopic);
  for (const f of sheet.floatingTopics ?? []) yield* walkTopic(f);
  for (const s of sheet.summaries ?? []) yield* walkTopic(s.summaryTopic);
}

/** Depth-first walk of a topic, including its children and callouts. */
export function* walkTopic(topic: Topic): Generator<Topic> {
  yield topic;
  for (const c of topic.children ?? []) yield* walkTopic(c);
  for (const c of topic.callouts ?? []) yield* walkTopic(c);
}

export function findTopic(sheet: Sheet, id: string): Topic | undefined {
  for (const t of walkSheetTopics(sheet)) if (t.id === id) return t;
  return undefined;
}

/** Find a topic and its parent (parent is undefined for roots/floating roots). */
export function findWithParent(
  sheet: Sheet,
  id: string,
): { topic: Topic; parent?: Topic } | undefined {
  const roots = [sheet.rootTopic, ...(sheet.floatingTopics ?? [])];
  for (const root of roots) {
    if (root.id === id) return { topic: root };
    const found = searchParent(root, id);
    if (found) return found;
  }
  return undefined;
}

function searchParent(
  node: Topic,
  id: string,
): { topic: Topic; parent: Topic } | undefined {
  for (const list of [node.children, node.callouts]) {
    for (const child of list ?? []) {
      if (child.id === id) return { topic: child, parent: node };
      const deeper = searchParent(child, id);
      if (deeper) return deeper;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Topic mutations
// ---------------------------------------------------------------------------

export function addChild(parent: Topic, title: string, partial: Partial<Topic> = {}): Topic {
  const child = createTopic(title, partial);
  (parent.children ??= []).push(child);
  return child;
}

/** Add a floating (unattached) topic at a canvas position. */
export function addFloatingTopic(
  sheet: Sheet,
  title: string,
  position: { x: number; y: number },
  partial: Partial<Topic> = {},
): Topic {
  const topic = createTopic(title, { position, ...partial });
  (sheet.floatingTopics ??= []).push(topic);
  return topic;
}

export function addSibling(
  sheet: Sheet,
  siblingId: string,
  title: string,
  partial: Partial<Topic> = {},
): Topic {
  const found = findWithParent(sheet, siblingId);
  if (!found?.parent) {
    throw new ModelError(`Cannot add sibling: "${siblingId}" has no parent (is it a root?).`);
  }
  const child = createTopic(title, partial);
  const siblings = found.parent.children!;
  const idx = siblings.findIndex((t) => t.id === siblingId);
  siblings.splice(idx + 1, 0, child);
  return child;
}

export function editText(topic: Topic, title: string): void {
  topic.title = title;
}

export function deleteTopic(sheet: Sheet, id: string): boolean {
  const found = findWithParent(sheet, id);
  if (!found) return false;
  if (!found.parent) {
    // A floating root can be removed; the central root cannot.
    const floats = sheet.floatingTopics ?? [];
    const idx = floats.findIndex((t) => t.id === id);
    if (idx === -1) throw new ModelError("Cannot delete the central root topic.");
    floats.splice(idx, 1);
  } else {
    removeChildRef(found.parent, id);
  }
  pruneDanglingConnectors(sheet);
  return true;
}

function removeChildRef(parent: Topic, id: string): void {
  for (const key of ["children", "callouts"] as const) {
    const list = parent[key];
    if (!list) continue;
    const idx = list.findIndex((t) => t.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      return;
    }
  }
}

/**
 * Reparent/reorder a topic. `index` inserts at that position among the new
 * parent's children (appends if omitted). Rejects moving a node into its own
 * subtree.
 */
export function moveTopic(
  sheet: Sheet,
  id: string,
  newParentId: string,
  index?: number,
): void {
  const node = findWithParent(sheet, id);
  if (!node) throw new ModelError(`Move failed: topic "${id}" not found.`);
  if (!node.parent) throw new ModelError("Cannot move a root/floating-root topic.");

  const target = findTopic(sheet, newParentId);
  if (!target) throw new ModelError(`Move failed: new parent "${newParentId}" not found.`);
  if (id === newParentId || isDescendant(node.topic, newParentId)) {
    throw new ModelError("Cannot move a topic into itself or its own descendant.");
  }

  removeChildRef(node.parent, id);
  const siblings = (target.children ??= []);
  const at = index === undefined ? siblings.length : Math.max(0, Math.min(index, siblings.length));
  siblings.splice(at, 0, node.topic);
}

function isDescendant(topic: Topic, candidateId: string): boolean {
  for (const t of walkTopic(topic)) if (t.id === candidateId && t !== topic) return true;
  return false;
}

/**
 * Deep-copy a topic subtree, assigning fresh ids throughout. The input must be
 * a plain (non-proxied) topic; the copy is safe to insert anywhere in any sheet
 * without id collisions — the basis for copy/paste and duplicate.
 */
export function cloneTopicWithNewIds(topic: Topic): Topic {
  const copy = structuredClone(topic);
  for (const t of walkTopic(copy)) t.id = newId("t");
  return copy;
}

export function toggleCollapse(topic: Topic): boolean {
  topic.collapsed = !topic.collapsed;
  return topic.collapsed;
}

// ---------------------------------------------------------------------------
// Connectors & groupings
// ---------------------------------------------------------------------------

export function addRelationship(
  sheet: Sheet,
  end1Id: string,
  end2Id: string,
  title?: string,
): Relationship {
  if (!findTopic(sheet, end1Id) || !findTopic(sheet, end2Id)) {
    throw new ModelError("Relationship endpoints must both exist in the sheet.");
  }
  const rel: Relationship = { id: newId("r"), end1Id, end2Id, title };
  (sheet.relationships ??= []).push(rel);
  return rel;
}

export function addBoundary(
  sheet: Sheet,
  parentId: string,
  childIds: string[],
  title?: string,
): Boundary {
  validateContiguousChildren(sheet, parentId, childIds, "boundary");
  const boundary: Boundary = { id: newId("b"), parentId, childIds, title };
  (sheet.boundaries ??= []).push(boundary);
  return boundary;
}

export function addSummary(
  sheet: Sheet,
  parentId: string,
  childIds: string[],
  summaryTitle: string,
): Summary {
  validateContiguousChildren(sheet, parentId, childIds, "summary");
  const summary: Summary = {
    id: newId("s"),
    parentId,
    childIds,
    summaryTopic: createTopic(summaryTitle),
  };
  (sheet.summaries ??= []).push(summary);
  return summary;
}

function validateContiguousChildren(
  sheet: Sheet,
  parentId: string,
  childIds: string[],
  kind: string,
): void {
  const parent = findTopic(sheet, parentId);
  if (!parent) throw new ModelError(`${kind}: parent "${parentId}" not found.`);
  const order = (parent.children ?? []).map((c) => c.id);
  const indices = childIds.map((id) => order.indexOf(id));
  if (indices.some((i) => i === -1)) {
    throw new ModelError(`${kind}: all child ids must be direct children of the parent.`);
  }
  const sorted = [...indices].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]! !== sorted[i - 1]! + 1) {
      throw new ModelError(`${kind}: child ids must form a contiguous range.`);
    }
  }
}

export function removeRelationship(sheet: Sheet, id: string): boolean {
  const before = sheet.relationships?.length ?? 0;
  if (sheet.relationships) sheet.relationships = sheet.relationships.filter((r) => r.id !== id);
  return (sheet.relationships?.length ?? 0) < before;
}

export function removeBoundary(sheet: Sheet, id: string): boolean {
  const before = sheet.boundaries?.length ?? 0;
  if (sheet.boundaries) sheet.boundaries = sheet.boundaries.filter((b) => b.id !== id);
  return (sheet.boundaries?.length ?? 0) < before;
}

export function removeSummary(sheet: Sheet, id: string): boolean {
  const before = sheet.summaries?.length ?? 0;
  if (sheet.summaries) sheet.summaries = sheet.summaries.filter((s) => s.id !== id);
  return (sheet.summaries?.length ?? 0) < before;
}

/** Drop relationships/boundaries/summaries that reference now-missing topics. */
export function pruneDanglingConnectors(sheet: Sheet): void {
  const ids = new Set<string>();
  for (const t of walkSheetTopics(sheet)) ids.add(t.id);

  if (sheet.relationships) {
    sheet.relationships = sheet.relationships.filter(
      (r) => ids.has(r.end1Id) && ids.has(r.end2Id),
    );
  }
  if (sheet.boundaries) {
    sheet.boundaries = sheet.boundaries.filter(
      (b) => ids.has(b.parentId) && b.childIds.every((c) => ids.has(c)),
    );
  }
  if (sheet.summaries) {
    sheet.summaries = sheet.summaries.filter(
      (s) => ids.has(s.parentId) && s.childIds.every((c) => ids.has(c)),
    );
  }
}

// ---------------------------------------------------------------------------
// Sheet & structure
// ---------------------------------------------------------------------------

export function setStructure(sheet: Sheet, structure: StructureId): void {
  sheet.structure = structure;
}

export function addSheet(workbook: Workbook, title: string, structure?: StructureId): Sheet {
  const sheet = createSheet(title, structure ? { structure } : {});
  workbook.sheets.push(sheet);
  return sheet;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class ModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelError";
  }
}

/** Assert that all topic ids in the workbook are unique. Returns the dup ids. */
export function findDuplicateIds(workbook: Workbook): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const sheet of workbook.sheets) {
    for (const t of walkSheetTopics(sheet)) {
      if (seen.has(t.id)) dups.add(t.id);
      seen.add(t.id);
    }
  }
  return [...dups];
}

/** Ensure every topic has an id, assigning fresh ones where missing (in place). */
export function ensureIds(workbook: Workbook): void {
  for (const sheet of workbook.sheets) {
    for (const t of walkSheetTopics(sheet)) {
      if (!t.id) t.id = newId("t");
    }
  }
}
