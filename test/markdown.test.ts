import { describe, it, expect } from "vitest";

import {
  addChild,
  createWorkbook,
  markdownToSheet,
  markdownToWorkbook,
  sheetToMarkdown,
  workbookToMarkdown,
  walkSheetTopics,
  type Sheet,
  type Topic,
} from "../src/index.js";

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

describe("markdown → sheet", () => {
  it("parses headings and nested lists into a tree", () => {
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
      "0:Project",
      "1:Research",
      "2:Competitors",
      "3:Tool A",
      "3:Tool B",
      "2:Interviews",
      "1:Build",
      "2:Frontend",
      "2:Backend",
      "3:API",
    ]);
  });

  it("reads frontmatter for structure/theme", () => {
    const md = `---
title: Plan
structure: org.down
theme: dark
---
# Plan
## A
`;
    const sheet = markdownToSheet(md);
    expect(sheet.structure).toBe("org.down");
    expect(sheet.theme).toBe("dark");
  });

  it("is lenient when there is no H1", () => {
    const sheet = markdownToSheet(`- lonely\n- items\n`);
    expect(sheet.rootTopic.title).toBe("Untitled");
    expect(sheet.rootTopic.children?.map((c) => c.title)).toEqual(["lonely", "items"]);
  });

  it("parses per-topic metadata from the trailing comment", () => {
    const md = `# Root
## Task <!-- vmm: {"markers":["priority-1"],"note":"do it","collapsed":true} -->
`;
    const sheet = markdownToSheet(md);
    const task = sheet.rootTopic.children![0]!;
    expect(task.markers).toEqual(["priority-1"]);
    expect(task.note?.plain).toBe("do it");
    expect(task.collapsed).toBe(true);
  });
});

describe("round-trip: sheet → markdown → sheet", () => {
  it("preserves the topic hierarchy", () => {
    const wb = createWorkbook("Root");
    const a = addChild(wb.sheets[0]!.rootTopic, "A");
    addChild(a, "A1");
    addChild(a, "A2");
    const b = addChild(wb.sheets[0]!.rootTopic, "B");
    addChild(b, "B1");

    const md = sheetToMarkdown(wb.sheets[0]!);
    const back = markdownToSheet(md);
    expect(outline(back)).toEqual(outline(wb.sheets[0]!));
  });

  it("preserves markers, notes, links, and collapsed state", () => {
    const wb = createWorkbook("Root");
    addChild(wb.sheets[0]!.rootTopic, "Styled", {
      markers: ["flag-red"],
      labels: ["urgent"],
      note: { plain: "remember this" },
      collapsed: true,
      hyperlink: { type: "web", value: "https://example.com" },
    });

    const md = sheetToMarkdown(wb.sheets[0]!);
    const back = markdownToSheet(md);
    const styled = back.rootTopic.children![0]!;
    expect(styled.markers).toEqual(["flag-red"]);
    expect(styled.labels).toEqual(["urgent"]);
    expect(styled.note?.plain).toBe("remember this");
    expect(styled.collapsed).toBe(true);
    expect(styled.hyperlink?.value).toBe("https://example.com");
  });
});

describe("workbook ↔ markdown (multi-sheet)", () => {
  it("round-trips multiple sheets via the sheet separator", () => {
    const wb = createWorkbook("Sheet A root");
    wb.sheets.push(markdownToSheet("# Sheet B root\n## child\n"));
    addChild(wb.sheets[0]!.rootTopic, "a-child");

    const md = workbookToMarkdown(wb);
    const back = markdownToWorkbook(md);
    expect(back.sheets).toHaveLength(2);
    expect(back.sheets[0]!.rootTopic.title).toBe("Sheet A root");
    expect(back.sheets[1]!.rootTopic.title).toBe("Sheet B root");
  });

  it("generates unique ids on import", () => {
    const wb = markdownToWorkbook("# R\n## a\n## b\n");
    const ids = new Set([...walkSheetTopics(wb.sheets[0]!)].map((t) => t.id));
    expect(ids.size).toBe(3);
  });

  it("preserves each sheet's structure across a workbook round-trip", () => {
    const wb = createWorkbook("First");
    wb.sheets[0]!.structure = "logic.right";
    const second = markdownToSheet("# Second\n## x\n");
    second.structure = "org.down";
    wb.sheets.push(second);

    const back = markdownToWorkbook(workbookToMarkdown(wb));
    expect(back.sheets.map((s) => s.structure)).toEqual(["logic.right", "org.down"]);
  });
});
