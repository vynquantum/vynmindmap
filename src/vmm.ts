/**
 * `.vmm` container reader/writer (DESIGN.md §4.1).
 *
 * A `.vmm` is a ZIP holding:
 *   manifest.json   — version + metadata (read first)
 *   content.json    — the workbook
 *   resources/...   — embedded binary assets (images, attachments)
 *
 * This module is environment-agnostic: it turns bytes <-> `VmmDocument`. It runs
 * unchanged in Node (tests, CLI) and in the Tauri webview. The host is responsible
 * only for getting the bytes to/from disk.
 */

import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import {
  type Manifest,
  type VmmDocument,
  type Workbook,
} from "./types.js";
import {
  APP_NAME,
  APP_VERSION,
  CURRENT_FORMAT_VERSION,
  migrateContent,
  parseVersion,
  VmmVersionError,
} from "./version.js";
import { findDuplicateIds } from "./model.js";

const MANIFEST_PATH = "manifest.json";
const CONTENT_PATH = "content.json";
const RESOURCE_PREFIX = "resources/";

export class VmmFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VmmFormatError";
  }
}

/** Result of reading a `.vmm`, with any non-fatal version warning surfaced. */
export interface ReadResult extends VmmDocument {
  /** True if the file came from a newer minor version (loaded leniently). */
  newerMinor: boolean;
  /** True if a major-version migration ran on load. */
  migrated: boolean;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function readVmm(bytes: Uint8Array): ReadResult {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (e) {
    throw new VmmFormatError(`Not a valid .vmm (zip) file: ${(e as Error).message}`);
  }

  const manifestBytes = entries[MANIFEST_PATH];
  if (!manifestBytes) throw new VmmFormatError("Missing manifest.json.");
  const manifest = parseManifest(manifestBytes);

  const contentBytes = entries[CONTENT_PATH];
  if (!contentBytes) throw new VmmFormatError("Missing content.json.");

  let rawContent: Record<string, unknown>;
  try {
    rawContent = JSON.parse(strFromU8(contentBytes)) as Record<string, unknown>;
  } catch (e) {
    throw new VmmFormatError(`content.json is not valid JSON: ${(e as Error).message}`);
  }

  // Version gate + migration (throws on newer-major / missing migrator).
  const result = migrateContent(rawContent, manifest.formatVersion);
  const workbook = toWorkbook(result.content);

  const dups = findDuplicateIds(workbook);
  if (dups.length) {
    throw new VmmFormatError(`Duplicate topic ids in content.json: ${dups.join(", ")}`);
  }

  const resources: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(entries)) {
    if (path.startsWith(RESOURCE_PREFIX)) resources[path] = data;
  }

  return {
    manifest: { ...manifest, formatVersion: result.version },
    workbook,
    resources,
    newerMinor: result.newerMinor,
    migrated: result.migrated,
  };
}

function parseManifest(bytes: Uint8Array): Manifest {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(strFromU8(bytes)) as Record<string, unknown>;
  } catch (e) {
    throw new VmmFormatError(`manifest.json is not valid JSON: ${(e as Error).message}`);
  }
  if (raw.format !== "vmm") {
    throw new VmmFormatError(`manifest.format must be "vmm", got ${JSON.stringify(raw.format)}.`);
  }
  if (typeof raw.formatVersion !== "string") {
    throw new VmmFormatError("manifest.formatVersion must be a string.");
  }
  parseVersion(raw.formatVersion); // validate shape early
  return {
    format: "vmm",
    formatVersion: raw.formatVersion,
    app: typeof raw.app === "string" ? raw.app : "unknown",
    appVersion: typeof raw.appVersion === "string" ? raw.appVersion : "0.0.0",
    created: typeof raw.created === "string" ? raw.created : new Date().toISOString(),
    modified: typeof raw.modified === "string" ? raw.modified : new Date().toISOString(),
  };
}

/**
 * Coerce raw parsed JSON into a `Workbook`, separating recognized fields from
 * unknown ones so a round-trip preserves data from newer minor versions
 * (DESIGN.md §7).
 */
function toWorkbook(content: Record<string, unknown>): Workbook {
  if (!Array.isArray(content.sheets)) {
    throw new VmmFormatError("content.sheets must be an array.");
  }
  const { id, sheets, ...rest } = content;
  const workbook: Workbook = {
    id: typeof id === "string" ? id : "",
    sheets: sheets as Workbook["sheets"],
  };
  if (Object.keys(rest).length) workbook._unknown = rest;
  return workbook;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export interface WriteOptions {
  /** Override the modified timestamp (defaults to now). */
  modified?: string;
  /** Preserve an existing created timestamp; defaults to now for new files. */
  created?: string;
  /** Pretty-print JSON (default true; the format is meant to be human-diffable). */
  pretty?: boolean;
}

/** Serialize a workbook (+ resources) into `.vmm` bytes. */
export function writeVmm(
  workbook: Workbook,
  resources: Record<string, Uint8Array> = {},
  options: WriteOptions = {},
): Uint8Array {
  const dups = findDuplicateIds(workbook);
  if (dups.length) {
    throw new VmmFormatError(`Refusing to write: duplicate topic ids: ${dups.join(", ")}`);
  }

  const now = new Date().toISOString();
  const manifest: Manifest = {
    format: "vmm",
    formatVersion: CURRENT_FORMAT_VERSION,
    app: APP_NAME,
    appVersion: APP_VERSION,
    created: options.created ?? now,
    modified: options.modified ?? now,
  };

  // Re-merge any preserved unknown fields back into the written content.
  const { _unknown, ...known } = workbook;
  const content = { ..._unknown, ...known };

  const indent = options.pretty === false ? undefined : 2;
  const files: Record<string, Uint8Array> = {
    [MANIFEST_PATH]: strToU8(JSON.stringify(manifest, null, indent)),
    [CONTENT_PATH]: strToU8(JSON.stringify(content, null, indent)),
  };
  for (const [path, data] of Object.entries(resources)) {
    const normalized = path.startsWith(RESOURCE_PREFIX) ? path : RESOURCE_PREFIX + path;
    files[normalized] = data;
  }

  return zipSync(files, { level: 6 });
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

/** Build a fresh `VmmDocument` wrapper around a workbook. */
export function newDocument(workbook: Workbook): VmmDocument {
  const now = new Date().toISOString();
  return {
    manifest: {
      format: "vmm",
      formatVersion: CURRENT_FORMAT_VERSION,
      app: APP_NAME,
      appVersion: APP_VERSION,
      created: now,
      modified: now,
    },
    workbook,
    resources: {},
  };
}

export { VmmVersionError };
