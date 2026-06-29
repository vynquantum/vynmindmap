import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { addChild, createWorkbook, readVmm } from "../src/index.js";
import { layoutBalanced, edgePath } from "../app/src/lib/layout.js";

const here = dirname(fileURLToPath(import.meta.url));
const examples = join(here, "..", "examples");

describe("layoutBalanced", () => {
  it("produces a node per visible topic and an edge per parent-child link", () => {
    const wb = createWorkbook("Root");
    const root = wb.sheets[0]!.rootTopic;
    const a = addChild(root, "A");
    addChild(root, "B");
    addChild(a, "A1");

    const layout = layoutBalanced(wb.sheets[0]!);
    // root + A + B + A1 = 4 nodes
    expect(layout.nodes).toHaveLength(4);
    // root→A, root→B, A→A1 = 3 edges
    expect(layout.edges).toHaveLength(3);
  });

  it("keeps all coordinates within the reported canvas size, margins included", () => {
    const wb = createWorkbook("Root");
    for (let i = 0; i < 8; i++) addChild(wb.sheets[0]!.rootTopic, `Branch ${i}`);
    const layout = layoutBalanced(wb.sheets[0]!);
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w).toBeLessThanOrEqual(layout.width);
      expect(n.y + n.h).toBeLessThanOrEqual(layout.height);
    }
  });

  it("splits children to both sides (balanced)", () => {
    const wb = createWorkbook("Root");
    for (let i = 0; i < 6; i++) addChild(wb.sheets[0]!.rootTopic, `n${i}`);
    const layout = layoutBalanced(wb.sheets[0]!);
    const sides = new Set(layout.nodes.filter((n) => n.depth === 1).map((n) => n.side));
    expect(sides).toContain("left");
    expect(sides).toContain("right");
  });

  it("hides children of a collapsed topic", () => {
    const wb = createWorkbook("Root");
    const a = addChild(wb.sheets[0]!.rootTopic, "A");
    addChild(a, "hidden");
    a.collapsed = true;
    const layout = layoutBalanced(wb.sheets[0]!);
    expect(layout.nodes.find((n) => n.topic.title === "hidden")).toBeUndefined();
    expect(layout.nodes.find((n) => n.id === a.id)!.hasHiddenChildren).toBe(true);
  });

  it("lays out the rich example without errors", () => {
    const bytes = readFileSync(join(examples, "rich.vmm"));
    const { workbook } = readVmm(bytes);
    const layout = layoutBalanced(workbook.sheets[0]!);
    expect(layout.nodes.length).toBeGreaterThan(3);
    expect(edgePath(layout.edges[0]!)).toMatch(/^M /);
  });
});
