import { describe, it, expect } from "vitest";

import {
  addBoundary,
  addChild,
  cloneTopicWithNewIds,
  walkTopic,
  addRelationship,
  addSibling,
  addSummary,
  createWorkbook,
  deleteTopic,
  findDuplicateIds,
  findTopic,
  ModelError,
  moveTopic,
  removeBoundary,
  removeRelationship,
  removeSummary,
  toggleCollapse,
  walkSheetTopics,
  type Sheet,
} from "../src/index.js";

function fixture(): { sheet: Sheet } {
  const wb = createWorkbook("Root");
  const sheet = wb.sheets[0]!;
  const a = addChild(sheet.rootTopic, "A");
  addChild(a, "A1");
  addChild(a, "A2");
  addChild(sheet.rootTopic, "B");
  return { sheet };
}

describe("tree mutations", () => {
  it("adds children and siblings in order", () => {
    const { sheet } = fixture();
    const a = findTopic(sheet, sheet.rootTopic.children![0]!.id)!;
    addSibling(sheet, a.children![0]!.id, "A1.5");
    expect(a.children!.map((c) => c.title)).toEqual(["A1", "A1.5", "A2"]);
  });

  it("refuses a sibling on a root", () => {
    const { sheet } = fixture();
    expect(() => addSibling(sheet, sheet.rootTopic.id, "X")).toThrow(ModelError);
  });

  it("generates unique ids across the workbook", () => {
    const wb = createWorkbook("Root");
    for (let i = 0; i < 50; i++) addChild(wb.sheets[0]!.rootTopic, `n${i}`);
    expect(findDuplicateIds(wb)).toEqual([]);
  });

  it("toggles collapse", () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    expect(toggleCollapse(a)).toBe(true);
    expect(toggleCollapse(a)).toBe(false);
  });
});

describe("move", () => {
  it("reparents a topic", () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const b = sheet.rootTopic.children![1]!;
    const a1 = a.children![0]!;
    moveTopic(sheet, a1.id, b.id);
    expect(a.children!.map((c) => c.title)).toEqual(["A2"]);
    expect(b.children!.map((c) => c.title)).toEqual(["A1"]);
  });

  it("inserts at an index", () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const b = sheet.rootTopic.children![1]!;
    moveTopic(sheet, b.id, a.id, 1);
    expect(a.children!.map((c) => c.title)).toEqual(["A1", "B", "A2"]);
  });

  it("rejects moving a node into its own subtree", () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const a1 = a.children![0]!;
    expect(() => moveTopic(sheet, a.id, a1.id)).toThrow(/itself or its own descendant/);
  });
});

describe("delete", () => {
  it("removes a subtree", () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    deleteTopic(sheet, a.id);
    expect(sheet.rootTopic.children!.map((c) => c.title)).toEqual(["B"]);
  });

  it("refuses to delete the central root", () => {
    const { sheet } = fixture();
    expect(() => deleteTopic(sheet, sheet.rootTopic.id)).toThrow(/central root/);
  });

  it("prunes relationships referencing a deleted topic", () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const b = sheet.rootTopic.children![1]!;
    addRelationship(sheet, a.id, b.id, "link");
    expect(sheet.relationships).toHaveLength(1);
    deleteTopic(sheet, a.id);
    expect(sheet.relationships).toHaveLength(0);
  });
});

describe("connectors & groupings", () => {
  it("rejects relationships with a missing endpoint", () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    expect(() => addRelationship(sheet, a.id, "nope")).toThrow(ModelError);
  });

  it("requires contiguous children for a boundary", () => {
    const { sheet } = fixture();
    const root = sheet.rootTopic;
    const c = addChild(root, "C"); // root now has A, B, C
    const a = root.children![0]!;
    // A and C are not contiguous (B is between them).
    expect(() => addBoundary(sheet, root.id, [a.id, c.id])).toThrow(/contiguous/);
  });

  it("removes relationships, boundaries, and summaries by id", () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const b = sheet.rootTopic.children![1]!;
    const rel = addRelationship(sheet, a.id, b.id);
    const ids = a.children!.map((c) => c.id);
    const bnd = addBoundary(sheet, a.id, ids);
    const sum = addSummary(sheet, a.id, ids, "sum");
    expect(removeRelationship(sheet, rel.id)).toBe(true);
    expect(removeBoundary(sheet, bnd.id)).toBe(true);
    expect(removeSummary(sheet, sum.id)).toBe(true);
    expect(sheet.relationships).toHaveLength(0);
    expect(sheet.boundaries).toHaveLength(0);
    expect(sheet.summaries).toHaveLength(0);
  });

  it("accepts a contiguous boundary and a summary", () => {
    const { sheet } = fixture();
    const a = sheet.rootTopic.children![0]!;
    const ids = a.children!.map((c) => c.id);
    expect(() => addBoundary(sheet, a.id, ids, "grp")).not.toThrow();
    const summary = addSummary(sheet, a.id, ids, "sum");
    // The summary topic should be discoverable in the sheet walk.
    const allIds = [...walkSheetTopics(sheet)].map((t) => t.id);
    expect(allIds).toContain(summary.summaryTopic.id);
  });
});

describe("cloneTopicWithNewIds", () => {
  it("deep-copies the subtree with fresh ids everywhere", () => {
    const wb = createWorkbook("Root");
    const root = wb.sheets[0]!.rootTopic;
    const a = addChild(root, "A", { markers: ["star"] });
    const a1 = addChild(a, "A1");
    addChild(a1, "A1a");

    const clone = cloneTopicWithNewIds(a);

    // Same shape and content…
    expect([...walkTopic(clone)].map((t) => t.title)).toEqual(
      [...walkTopic(a)].map((t) => t.title),
    );
    expect(clone.markers).toEqual(["star"]);

    // …but no id collides with the original subtree.
    const origIds = new Set([...walkTopic(a)].map((t) => t.id));
    for (const t of walkTopic(clone)) expect(origIds.has(t.id)).toBe(false);

    // Pasting the clone back keeps the workbook free of duplicate ids.
    root.children!.push(clone);
    expect(findDuplicateIds(wb)).toEqual([]);
  });

  it("does not mutate the source topic", () => {
    const wb = createWorkbook("Root");
    const a = addChild(wb.sheets[0]!.rootTopic, "A");
    const before = a.id;
    cloneTopicWithNewIds(a);
    expect(a.id).toBe(before);
  });
});
