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

/** Path of a `.vmm` the app was launched with (file association), or null. */
export async function getOpenedFile(): Promise<string | null> {
  return (await invoke<string | null>("get_opened_file")) ?? null;
}

/** Subscribe to "open this .vmm" events from a second launch (single-instance). */
export async function onOpenFile(cb: (path: string) => void): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<string>("open-file", (e) => cb(e.payload));
}

// --- browser File System Access API (Chromium) ----------------------------
interface SaveablePicker {
  showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle>;
}
export function hasFilePicker(): boolean {
  return typeof (window as unknown as SaveablePicker).showSaveFilePicker === "function";
}

/** Returns true if it saved, false if the user cancelled. */
export async function browserSavePicker(defaultName: string, bytes: Uint8Array): Promise<boolean> {
  const picker = (window as unknown as SaveablePicker).showSaveFilePicker!;
  try {
    const handle = await picker({
      suggestedName: defaultName,
      types: [{ description: "VynMindMap mind map", accept: { "application/octet-stream": [".vmm"] } }],
    });
    const w = await handle.createWritable();
    await w.write(bytes as BlobPart);
    await w.close();
    return true;
  } catch (e) {
    if ((e as DOMException)?.name === "AbortError") return false;
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
