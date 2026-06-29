/**
 * Browser-side helpers to load a `.vmm` from a File and to fetch a bundled
 * example. Both funnel into the shared core `readVmm`, so the browser preview and
 * the eventual Tauri app parse files identically.
 */

import { readVmm, type ReadResult } from "../../../src/index.js";

export async function readVmmFromFile(file: File): Promise<ReadResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  return readVmm(buf);
}

export async function readVmmFromUrl(url: string): Promise<ReadResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return readVmm(buf);
}
