import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";

import {
  CURRENT_FORMAT_VERSION,
  compareVersions,
  isReadable,
  migrateContent,
  parseVersion,
  readVmm,
  VmmVersionError,
  VmmFormatError,
  createWorkbook,
} from "../src/index.js";

function makeVmm(formatVersion: string, content: unknown): Uint8Array {
  return zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        format: "vmm",
        formatVersion,
        app: "test",
        appVersion: "0",
        created: "2026-01-01T00:00:00Z",
        modified: "2026-01-01T00:00:00Z",
      }),
    ),
    "content.json": strToU8(JSON.stringify(content)),
  });
}

describe("version parsing", () => {
  it("parses MAJOR.MINOR", () => {
    expect(parseVersion("2.5")).toEqual({ major: 2, minor: 5 });
  });
  it("rejects malformed versions", () => {
    expect(() => parseVersion("1")).toThrow(VmmVersionError);
    expect(() => parseVersion("1.2.3")).toThrow(VmmVersionError);
    expect(() => parseVersion("x.y")).toThrow(VmmVersionError);
  });
  it("compares correctly", () => {
    expect(compareVersions(parseVersion("1.0"), parseVersion("1.2"))).toBeLessThan(0);
    expect(compareVersions(parseVersion("2.0"), parseVersion("1.9"))).toBeGreaterThan(0);
  });
});

describe("migrateContent gate", () => {
  const content = { id: "wb", sheets: [] };

  it("accepts the current version unchanged", () => {
    const r = migrateContent(content, CURRENT_FORMAT_VERSION);
    expect(r.migrated).toBe(false);
    expect(r.newerMinor).toBe(false);
  });

  it("flags a newer minor as lenient-loadable", () => {
    const r = migrateContent(content, "1.99");
    expect(r.newerMinor).toBe(true);
    expect(r.migrated).toBe(false);
  });

  it("rejects a newer major", () => {
    expect(() => migrateContent(content, "2.0")).toThrow(VmmVersionError);
  });

  it("rejects an older major with no migrator registered", () => {
    // CURRENT is 1.x and there are no migrators yet, so a hypothetical 0.x
    // file has no path forward — surfaced as a clear error.
    expect(() => migrateContent(content, "0.9")).toThrow(/No migrator/);
  });
});

describe("isReadable", () => {
  it("is true for same/older major, false for newer major", () => {
    expect(isReadable("1.0")).toBe(true);
    expect(isReadable("1.50")).toBe(true);
    expect(isReadable("2.0")).toBe(false);
  });
});

describe("readVmm version handling", () => {
  it("loads a newer-minor file and reports newerMinor", () => {
    const wb = createWorkbook("X");
    const bytes = makeVmm("1.99", wb);
    const r = readVmm(bytes);
    expect(r.newerMinor).toBe(true);
    expect(r.manifest.formatVersion).toBe("1.99");
  });

  it("refuses a newer-major file", () => {
    const wb = createWorkbook("X");
    expect(() => readVmm(makeVmm("2.0", wb))).toThrow(VmmVersionError);
  });
});

describe("readVmm error handling", () => {
  it("rejects non-zip bytes", () => {
    expect(() => readVmm(new Uint8Array([1, 2, 3, 4]))).toThrow(VmmFormatError);
  });
  it("rejects a zip missing manifest.json", () => {
    const bytes = zipSync({ "content.json": strToU8("{}") });
    expect(() => readVmm(bytes)).toThrow(/manifest/i);
  });
  it("rejects a zip missing content.json", () => {
    const bytes = zipSync({
      "manifest.json": strToU8(JSON.stringify({ format: "vmm", formatVersion: "1.0" })),
    });
    expect(() => readVmm(bytes)).toThrow(/content\.json/i);
  });
  it("rejects a wrong format marker", () => {
    const bytes = zipSync({
      "manifest.json": strToU8(JSON.stringify({ format: "xmind", formatVersion: "1.0" })),
      "content.json": strToU8("{}"),
    });
    expect(() => readVmm(bytes)).toThrow(/format/i);
  });
});
