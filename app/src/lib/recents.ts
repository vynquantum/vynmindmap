/**
 * Recent-files store for the welcome screen.
 *
 * Two backends, one API:
 * - Native (Tauri): file paths, persisted in localStorage.
 * - Browser: FileSystemFileHandles, persisted in IndexedDB (handles are
 *   structured-cloneable, so they survive reloads; re-opening one only needs a
 *   permission re-grant, which happens inside the user's click gesture).
 */

import type { FsFileHandle } from "./platform.js";

export interface RecentEntry {
  kind: "path" | "handle";
  name: string;
  /** Last opened/saved, ms since epoch. */
  when: number;
  /** Native absolute path (kind === "path"). */
  path?: string;
  /** Browser file handle (kind === "handle"). */
  handle?: FsFileHandle;
}

const MAX_RECENTS = 8;
const LS_KEY = "vynmm.recents";
const DB_NAME = "vynmm";
const DB_STORE = "recents";

// --- localStorage backend (native paths) -----------------------------------

function readLs(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(list) ? list.filter((e) => e.kind === "path" && e.path) : [];
  } catch {
    return [];
  }
}

function writeLs(list: RecentEntry[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch { /* storage full/blocked — recents are best-effort */ }
}

// --- IndexedDB backend (browser handles) -----------------------------------

interface HandleRow { key: number; name: string; when: number; handle: FsFileHandle }

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") { resolve(null); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) {
        req.result.createObjectStore(DB_STORE, { keyPath: "key", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function idbAll(db: IDBDatabase): Promise<HandleRow[]> {
  return new Promise((resolve) => {
    const req = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as HandleRow[]);
    req.onerror = () => resolve([]);
  });
}

function idbTx(db: IDBDatabase, fn: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    fn(tx.objectStore(DB_STORE));
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

// --- public API -------------------------------------------------------------

export async function getRecents(): Promise<RecentEntry[]> {
  const paths = readLs();
  let handles: RecentEntry[] = [];
  const db = await openDb();
  if (db) {
    const rows = await idbAll(db);
    handles = rows.map((r) => ({ kind: "handle" as const, name: r.name, when: r.when, handle: r.handle }));
    db.close();
  }
  return [...paths, ...handles]
    .sort((a, b) => b.when - a.when)
    .slice(0, MAX_RECENTS);
}

export async function addRecentPath(path: string, name: string): Promise<void> {
  const list = readLs().filter((e) => e.path !== path);
  list.unshift({ kind: "path", name, when: Date.now(), path });
  writeLs(list.slice(0, MAX_RECENTS));
}

export async function addRecentHandle(handle: FsFileHandle, name: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const rows = await idbAll(db);
  // Dedupe: same underlying file (isSameEntry) or, failing that, same name.
  const same = await Promise.all(rows.map(async (r) => {
    const sameEntry = (r.handle as { isSameEntry?: (o: unknown) => Promise<boolean> }).isSameEntry;
    try {
      return sameEntry ? await sameEntry.call(r.handle, handle) : r.name === name;
    } catch {
      return r.name === name;
    }
  }));
  await idbTx(db, (store) => {
    rows.forEach((r, i) => { if (same[i]) store.delete(r.key); });
    store.add({ name, when: Date.now(), handle });
  });
  // Trim to the cap, oldest first.
  const after = await idbAll(db);
  if (after.length > MAX_RECENTS) {
    const excess = after.sort((a, b) => a.when - b.when).slice(0, after.length - MAX_RECENTS);
    await idbTx(db, (store) => { for (const r of excess) store.delete(r.key); });
  }
  db.close();
}

/** Drop an entry (e.g. after the file turned out to be gone). */
export async function removeRecent(entry: RecentEntry): Promise<void> {
  if (entry.kind === "path") {
    writeLs(readLs().filter((e) => e.path !== entry.path));
    return;
  }
  const db = await openDb();
  if (!db) return;
  const rows = await idbAll(db);
  const same = await Promise.all(rows.map(async (r) => {
    const sameEntry = (r.handle as { isSameEntry?: (o: unknown) => Promise<boolean> }).isSameEntry;
    try {
      return sameEntry && entry.handle ? await sameEntry.call(r.handle, entry.handle) : r.name === entry.name;
    } catch {
      return r.name === entry.name;
    }
  }));
  await idbTx(db, (store) => { rows.forEach((r, i) => { if (same[i]) store.delete(r.key); }); });
  db.close();
}
