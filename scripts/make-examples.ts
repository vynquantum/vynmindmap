/**
 * Generates real `.vmm` files under examples/ so the format is concrete and the
 * tests have fixtures to read. Run with `npm run examples`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  addBoundary,
  addChild,
  addRelationship,
  addSheet,
  addSummary,
  createSheet,
  createTopic,
  createWorkbook,
  writeVmm,
  type Workbook,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "examples");
mkdirSync(outDir, { recursive: true });

function save(name: string, wb: Workbook): void {
  const bytes = writeVmm(wb, {}, { created: "2026-06-27T00:00:00Z", modified: "2026-06-27T00:00:00Z" });
  const path = join(outDir, name);
  writeFileSync(path, bytes);
  console.log(`wrote ${path} (${bytes.length} bytes)`);
}

// 1) Minimal: just a central topic and two branches.
{
  const wb = createWorkbook("Hello VynMM");
  const root = wb.sheets[0]!.rootTopic;
  addChild(root, "First idea");
  addChild(root, "Second idea");
  save("minimal.vmm", wb);
}

// 2) Rich: styles, markers, notes, a relationship, a boundary, a summary,
//    a floating topic, and a second sheet with a different structure.
{
  const wb = createWorkbook("Project Plan");
  const sheet = wb.sheets[0]!;
  sheet.title = "Plan";
  sheet.settings = { rainbowBranches: true };
  const root = sheet.rootTopic;
  root.style = { shape: "rounded", fillColor: "#2b6cb0", font: { color: "#fff", weight: "bold" } };

  const research = addChild(root, "Research", {
    markers: ["priority-1"],
    note: { plain: "Due end of month." },
  });
  const compA = addChild(research, "Competitor A", { hyperlink: { type: "web", value: "https://example.com" } });
  const compB = addChild(research, "Competitor B");
  addChild(research, "User interviews");

  const build = addChild(root, "Build", { style: { fillColor: "#38a169" } });
  const frontend = addChild(build, "Frontend");
  const backend = addChild(build, "Backend");
  addChild(backend, "API");
  addChild(backend, "Database");

  // Cross-link: research informs the frontend.
  addRelationship(sheet, research.id, frontend.id, "informs");
  // Boundary grouping the two competitor topics.
  addBoundary(sheet, research.id, [compA.id, compB.id], "Market scan");
  // Summary over Frontend + Backend.
  addSummary(sheet, build.id, [frontend.id, backend.id], "Deliverables");

  // A floating topic, positioned manually.
  const floating = createTopic("Parking lot", { position: { x: 480, y: -120 } });
  addChild(floating, "Mobile app (later)");
  (sheet.floatingTopics ??= []).push(floating);

  // Second sheet using an org-chart structure.
  const team = addSheet(wb, "Team", "org.down");
  team.rootTopic.title = "CEO";
  addChild(team.rootTopic, "Engineering");
  addChild(team.rootTopic, "Design");

  save("rich.vmm", wb);
}

// 3) Structures gallery: one sheet per structure id, to exercise the field.
{
  const wb: Workbook = createWorkbook("Structures");
  wb.sheets = [];
  const structures = [
    "map.balanced", "logic.right", "org.down", "tree.right",
    "timeline.h", "fishbone.right", "matrix", "tree-table", "brace.right",
  ] as const;
  for (const s of structures) {
    const sheet = createSheet(s, { structure: s, rootTopic: createTopic(s) });
    addChild(sheet.rootTopic, "Node 1");
    addChild(sheet.rootTopic, "Node 2");
    wb.sheets.push(sheet);
  }
  save("structures.vmm", wb);
}

console.log("done.");
