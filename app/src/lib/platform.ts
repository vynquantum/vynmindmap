/**
 * Platform abstraction for opening/saving `.vmm` files.
 *
 * In the native Tauri app we use OS-native save/open dialogs plus small Rust
 * commands (read_file_bytes / write_file_bytes) for the actual disk I/O. In a
 * plain browser (dev preview) we fall back to the File System Access API when
 * available, otherwise a download.
 */

import { invoke } from "@tauri-apps/api/core";

const VMM_FILTER = [{ name: "VynMindMap mind map", extensions: ["vmm"] }];

export function isTauri(): boolean {
  return typeof (globalThis as Record<string, unknown>).__TAURI_INTERNALS__ !== "undefined";
}

export function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

// --- native (Tauri) -------------------------------------------------------
export async function nativeSaveDialog(defaultName: string): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const path = await save({ defaultPath: defaultName, filters: VMM_FILTER });
  return path ?? null;
}

export async function nativeOpenDialog(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const res = await open({ multiple: false, directory: false, filters: VMM_FILTER });
  return typeof res === "string" ? res : null;
}

export async function nativeWrite(path: string, bytes: Uint8Array): Promise<void> {
  await invoke("write_file_bytes", { path, contents: Array.from(bytes) });
}

export async function nativeRead(path: string): Promise<Uint8Array> {
  const arr = await invoke<number[]>("read_file_bytes", { path });
  return new Uint8Array(arr);
}

/**
 * Last-modified time (ms since epoch) of a file, for external-change detection.
 * Returns null when the command isn't available (older shell build) or the
 * file is gone — callers should treat null as "cannot watch".
 */
export async function nativeModifiedMs(path: string): Promise<number | null> {
  try {
    return await invoke<number>("file_modified_ms", { path });
  } catch {
    return null;
  }
}

/** Path of a `.vmm` the app was launched with (file association), or null. */
export async function getOpenedFile(): Promise<string | null> {
  return (await invoke<string | null>("get_opened_file")) ?? null;
}

/** Subscribe to "open this .vmm" events from a second launch (single-instance). */
export async function onOpenFile(cb: (path: string) => void): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<string>("open-file", (e) => cb(e.payload));
}

/** Open a URL in the user's default browser (native) or a new tab (browser). */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) await invoke("open_external", { url });
  else window.open(url, "_blank", "noopener");
}

// ---------------------------------------------------------------------------
// Update check against GitHub Releases
// ---------------------------------------------------------------------------

const REPO = "vynquantum/vynmindmap";

export interface UpdateInfo {
  version: string;
  url: string;
}

/** Compare dotted numeric versions; true if `a` is newer than `b`. */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

async function currentVersion(): Promise<string> {
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return "0.0.0";
  }
}

/**
 * Ask GitHub for the latest published release and return it if it's newer than
 * the running app. Only meaningful in the native app; returns null on any error
 * (offline, no releases yet, rate-limited).
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    const latest = (data.tag_name ?? "").replace(/^v/i, "");
    if (!latest) return null;
    const current = await currentVersion();
    return isNewer(latest, current) ? { version: latest, url: data.html_url ?? `https://github.com/${REPO}/releases/latest` } : null;
  } catch {
    return null;
  }
}

// --- browser File System Access API (Chromium) ----------------------------

/**
 * Minimal FileSystemFileHandle surface we rely on. Keeping the handle around
 * is what lets "Save" write back to the same file without re-prompting.
 */
export interface FsFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: BlobPart): Promise<void>; close(): Promise<void> }>;
  queryPermission?(opts: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(opts: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

interface PickerWindow {
  showSaveFilePicker?: (opts: unknown) => Promise<FsFileHandle>;
  showOpenFilePicker?: (opts: unknown) => Promise<FsFileHandle[]>;
}

const VMM_PICKER_TYPES = [
  { description: "VynMindMap mind map", accept: { "application/octet-stream": [".vmm"] } },
];

export function hasFilePicker(): boolean {
  return typeof (window as unknown as PickerWindow).showSaveFilePicker === "function";
}
export function hasOpenPicker(): boolean {
  return typeof (window as unknown as PickerWindow).showOpenFilePicker === "function";
}

/** Prompt for a save location. Returns the handle (keep it!), or null if cancelled. */
export async function browserSavePicker(defaultName: string): Promise<FsFileHandle | null> {
  try {
    return await (window as unknown as PickerWindow).showSaveFilePicker!({
      suggestedName: defaultName,
      types: VMM_PICKER_TYPES,
    });
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return null;
    throw e;
  }
}

/** Prompt for a file to open. Returns the handle (writable later), or null if cancelled. */
export async function browserOpenPicker(): Promise<FsFileHandle | null> {
  try {
    const [handle] = await (window as unknown as PickerWindow).showOpenFilePicker!({
      multiple: false,
      types: VMM_PICKER_TYPES,
    });
    return handle ?? null;
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return null;
    throw e;
  }
}

/**
 * Write to a previously-obtained handle. Tries the write directly — a handle
 * fresh from a picker is always writable, and pre-checking permissions can
 * spuriously deny (requestPermission needs user activation that async work may
 * have consumed). Only on an actual NotAllowedError do we re-request and retry.
 */
export async function browserWriteHandle(handle: FsFileHandle, bytes: Uint8Array): Promise<void> {
  const write = async () => {
    const w = await handle.createWritable();
    await w.write(bytes as BlobPart);
    await w.close();
  };
  try {
    await write();
  } catch (e) {
    const name = (e as DOMException)?.name;
    if ((name === "NotAllowedError" || name === "SecurityError") && handle.requestPermission) {
      // Re-request and retry once. Note: without live user activation the
      // browser auto-denies this, so callers should treat a second failure
      // as "this site isn't allowed to edit files" and fall back.
      if ((await handle.requestPermission({ mode: "readwrite" })) === "granted") {
        await write();
        return;
      }
      throw new Error(`write permission to the file was denied (${name})`);
    }
    throw e;
  }
}

export function browserDownload(name: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
