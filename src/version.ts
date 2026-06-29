/**
 * Format versioning & migrations (DESIGN.md §7).
 *
 * `formatVersion` is "MAJOR.MINOR":
 *   - MINOR bumps are additive / backward-compatible. An older app opening a
 *     newer-minor file loads it leniently and preserves unknown fields.
 *   - MAJOR bumps are breaking. Each step up is handled by a registered migrator
 *     that upgrades the parsed content in memory before the model is built.
 */

import type { Workbook } from "./types.js";

/** The format version this build writes. */
export const CURRENT_FORMAT_VERSION = "1.0";

export const APP_NAME = "VynMM";
export const APP_VERSION = "0.1.0";

export interface SemVer {
  major: number;
  minor: number;
}

export function parseVersion(v: string): SemVer {
  const m = /^(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) throw new VmmVersionError(`Malformed formatVersion: "${v}"`);
  return { major: Number(m[1]), minor: Number(m[2]) };
}

export function compareVersions(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major;
  return a.minor - b.minor;
}

export class VmmVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VmmVersionError";
  }
}

/**
 * A migrator upgrades a raw parsed `content.json` object from one MAJOR version
 * to the next. It works on the loosely-typed JSON (not the `Workbook` model)
 * because the model shape itself may differ across major versions.
 */
export interface Migrator {
  /** Major version this migrator upgrades *from*. */
  fromMajor: number;
  /** Resulting "MAJOR.MINOR" version string. */
  to: string;
  migrate(content: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Registered migrators, keyed by the MAJOR version they upgrade from.
 * v1 is the first release, so there is nothing to migrate yet. When a breaking
 * v2 schema lands, add `{ fromMajor: 1, to: "2.0", migrate: ... }`.
 */
export const MIGRATORS: Migrator[] = [
  // Example placeholder for the future — intentionally empty in v1.
  // { fromMajor: 1, to: "2.0", migrate: (c) => ({ ...c, /* reshape */ }) },
];

export interface MigrationResult {
  content: Record<string, unknown>;
  /** Version after migration. */
  version: string;
  /** Whether any migrator ran. */
  migrated: boolean;
  /** True if the file is newer-minor than this build (loaded leniently). */
  newerMinor: boolean;
}

/**
 * Bring a raw parsed content object up to `CURRENT_FORMAT_VERSION`'s major line.
 *
 * - Older major → run migrators in sequence (throws if a step is missing).
 * - Newer major → throw (this build cannot safely read it).
 * - Same major, any minor → accept; flags `newerMinor` if minor is ahead.
 */
export function migrateContent(
  content: Record<string, unknown>,
  fileVersion: string,
): MigrationResult {
  const current = parseVersion(CURRENT_FORMAT_VERSION);
  let v = parseVersion(fileVersion);
  let working = content;
  let migrated = false;

  if (v.major > current.major) {
    throw new VmmVersionError(
      `File format ${fileVersion} is newer than supported ${CURRENT_FORMAT_VERSION}. ` +
        `Please update ${APP_NAME}.`,
    );
  }

  while (v.major < current.major) {
    const migrator = MIGRATORS.find((m) => m.fromMajor === v.major);
    if (!migrator) {
      throw new VmmVersionError(
        `No migrator registered to upgrade format major version ${v.major}.`,
      );
    }
    working = migrator.migrate(working);
    v = parseVersion(migrator.to);
    migrated = true;
  }

  const newerMinor = v.major === current.major && v.minor > current.minor;

  return {
    content: working,
    version: `${v.major}.${v.minor}`,
    migrated,
    newerMinor,
  };
}

/** A version is readable if its major is <= ours. */
export function isReadable(fileVersion: string): boolean {
  return parseVersion(fileVersion).major <= parseVersion(CURRENT_FORMAT_VERSION).major;
}
