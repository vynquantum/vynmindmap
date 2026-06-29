import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  addChild,
  createWorkbook,
  readVmm,
  writeVmm,
  type Workbook,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const examples = join(here, "..", "examples");

function roundtrip(wb: Workbook, resources: Record<string, Uint8Array> = {}): Workbook {
  const bytes = writeVmm(wb, resources);
  return readVmm(bytes).workbook;
}

describe("write → read round-trip", () => {
  it("preserves a minimal workbook exactly", () => {
    const wb = createWorkbook("Root");
    addChild(wb.sheets[0]!.rootTopic, "A");
    addChild(wb.sheets[0]!.rootTopic, "B");

    const back = roundtrip(wb);
    expect(back).toEqual(wb);
  });

  it("is stable: read→write→read yields identical bytes", () => {
    const wb = createWorkbook("Stable");
    addChild(wb.sheets[0]!.rootTopic, "child");

    const bytes1 = writeVmm(wb, {}, { created: "2026-01-01T00:00:00Z", modified: "2026-01-01T00:00:00Z" });
    const wb2 = readVmm(bytes1).workbook;
    const bytes2 = writeVmm(wb2, {}, { created: "2026-01-01T00:00:00Z", modified: "2026-01-01T00:00:00Z" });
    expect(Buffer.from(bytes2)).toEqual(Buffer.from(bytes1));
  });

  it("round-trips embedded resources byte-for-byte", () => {
    const wb = createWorkbook("WithImage");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const bytes = writeVmm(wb, { "resources/img.png": png });
    const doc = readVmm(bytes);
    expect(doc.resources["resources/img.png"]).toEqual(png);
  });

  it("normalizes bare resource paths under resources/", () => {
    const wb = createWorkbook("Paths");
    const data = new Uint8Array([9, 9, 9]);
    const bytes = writeVmm(wb, { "img.png": data }); // no prefix
    const doc = readVmm(bytes);
    expect(doc.resources["resources/img.png"]).toEqual(data);
  });

  for (const name of ["minimal.vmm", "rich.vmm", "structures.vmm"]) {
    it(`reads and re-round-trips example ${name}`, () => {
      const bytes = readFileSync(join(examples, name));
      const wb = readVmm(bytes).workbook;
      const back = roundtrip(wb);
      expect(back).toEqual(wb);
    });
  }
});

describe("forward-compat: unknown fields", () => {
  it("preserves unknown top-level fields across a round-trip", () => {
    const wb = createWorkbook("Future");
    // Simulate a field written by a newer minor version.
    (wb as unknown as Record<string, unknown>).futureFeature = { enabled: true };

    const back = roundtrip(wb) as unknown as Record<string, unknown> & Workbook;
    expect(back._unknown).toEqual({ futureFeature: { enabled: true } });

    // And it should be re-emitted, not dropped, on the next write.
    const bytes = writeVmm(back);
    const reparsed = readVmm(bytes).workbook as unknown as Record<string, unknown>;
    expect(reparsed._unknown).toEqual({ futureFeature: { enabled: true } });
  });
});
