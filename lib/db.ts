import type { LibraryItem, Composition } from "../types";

const DB_NAME = "scene-builder";
const DB_VERSION = 1;
const STORE_LIBRARY = "library";
const STORE_COMPOSITIONS = "compositions";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_LIBRARY)) {
        const store = db.createObjectStore(STORE_LIBRARY, { keyPath: "id" });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_COMPOSITIONS)) {
        db.createObjectStore(STORE_COMPOSITIONS, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx(
  storeName: string,
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  return openDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

function idbGetAll<T>(storeName: string): Promise<T[]> {
  return tx(storeName, "readonly").then(
    (store) =>
      new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return tx(storeName, "readonly").then(
    (store) =>
      new Promise((resolve, reject) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut<T>(storeName: string, item: T): Promise<void> {
  return tx(storeName, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbDelete(storeName: string, key: string): Promise<void> {
  return tx(storeName, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbClear(storeName: string): Promise<void> {
  return tx(storeName, "readwrite").then(
    (store) =>
      new Promise((resolve, reject) => {
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      }),
  );
}

// ─── Migration ────────────────────────────────────────────────────────────────

const MIGRATED_KEY = "scene-builder-idb-migrated";

async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATED_KEY)) return;

  try {
    const libRaw = localStorage.getItem("scene-builder-library");
    if (libRaw) {
      const items: LibraryItem[] = JSON.parse(libRaw);
      for (const item of items) {
        await idbPut(STORE_LIBRARY, item);
      }
    }

    const compRaw = localStorage.getItem("scene-builder-compositions");
    if (compRaw) {
      const comps: Composition[] = JSON.parse(compRaw);
      for (const comp of comps) {
        await idbPut(STORE_COMPOSITIONS, comp);
      }
    }

    localStorage.setItem(MIGRATED_KEY, "1");
  } catch (e) {
    console.warn("IndexedDB migration from localStorage failed:", e);
  }
}

let migrationDone: Promise<void> | null = null;

function ensureMigrated(): Promise<void> {
  if (!migrationDone) {
    migrationDone = migrateFromLocalStorage();
  }
  return migrationDone;
}

// ─── Public API: Library ──────────────────────────────────────────────────────

export async function getLibrary(): Promise<LibraryItem[]> {
  await ensureMigrated();
  return idbGetAll<LibraryItem>(STORE_LIBRARY);
}

export async function getLibraryItem(
  id: string,
): Promise<LibraryItem | undefined> {
  await ensureMigrated();
  return idbGet<LibraryItem>(STORE_LIBRARY, id);
}

export async function saveLibraryItem(item: LibraryItem): Promise<void> {
  await ensureMigrated();
  await idbPut(STORE_LIBRARY, { ...item, updatedAt: Date.now() });
}

export async function deleteLibraryItem(id: string): Promise<void> {
  await ensureMigrated();
  await idbDelete(STORE_LIBRARY, id);
}

export async function duplicateLibraryItem(
  id: string,
  newName?: string,
): Promise<LibraryItem | null> {
  const original = await getLibraryItem(id);
  if (!original) return null;
  const copy: LibraryItem = {
    ...original,
    id: generateId(),
    name: newName || `${original.name} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveLibraryItem(copy);
  return copy;
}

// ─── Public API: Compositions ─────────────────────────────────────────────────

export async function getCompositions(): Promise<Composition[]> {
  await ensureMigrated();
  return idbGetAll<Composition>(STORE_COMPOSITIONS);
}

export async function saveComposition(comp: Composition): Promise<void> {
  // #region agent log
  fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:saveComposition',message:'entered',data:{compId:comp.id,compName:comp.name},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  try {
    await ensureMigrated();
    // #region agent log
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:saveComposition',message:'migration done, calling idbPut',data:{compId:comp.id},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    await idbPut(STORE_COMPOSITIONS, comp);
    // #region agent log
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:saveComposition',message:'idbPut OK',data:{compId:comp.id},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  } catch (err: any) {
    // #region agent log
    fetch('/api/debug-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'db.ts:saveComposition',message:'THREW',data:{error:err?.message,name:err?.name,stack:err?.stack?.slice(0,300)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw err;
  }
}

export async function deleteComposition(id: string): Promise<void> {
  await ensureMigrated();
  await idbDelete(STORE_COMPOSITIONS, id);
}

// ─── File Import / Export ─────────────────────────────────────────────────────

export interface ExportBundle {
  version: 1;
  exportedAt: number;
  library: LibraryItem[];
  compositions: Composition[];
}

export async function exportToFile(): Promise<void> {
  const library = await getLibrary();
  const compositions = await getCompositions();

  const bundle: ExportBundle = {
    version: 1,
    exportedAt: Date.now(),
    library,
    compositions,
  };

  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `scene-builder-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportLibraryToFile(ids?: string[]): Promise<void> {
  let library = await getLibrary();
  if (ids) library = library.filter((item) => ids.includes(item.id));

  const bundle: ExportBundle = {
    version: 1,
    exportedAt: Date.now(),
    library,
    compositions: [],
  };

  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `scene-builder-items-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  libraryAdded: number;
  librarySkipped: number;
  compositionsAdded: number;
  compositionsSkipped: number;
}

export async function importFromFile(
  file: File,
  mode: "merge" | "replace" = "merge",
): Promise<ImportResult> {
  const text = await file.text();
  const bundle: ExportBundle = JSON.parse(text);

  if (!bundle.version || !Array.isArray(bundle.library)) {
    throw new Error("Invalid backup file format");
  }

  const result: ImportResult = {
    libraryAdded: 0,
    librarySkipped: 0,
    compositionsAdded: 0,
    compositionsSkipped: 0,
  };

  if (mode === "replace") {
    await idbClear(STORE_LIBRARY);
    await idbClear(STORE_COMPOSITIONS);
  }

  const existingLib = mode === "merge" ? await getLibrary() : [];
  const existingIds = new Set(existingLib.map((i) => i.id));

  for (const item of bundle.library) {
    if (mode === "merge" && existingIds.has(item.id)) {
      result.librarySkipped++;
    } else {
      await idbPut(STORE_LIBRARY, item);
      result.libraryAdded++;
    }
  }

  const existingComps = mode === "merge" ? await getCompositions() : [];
  const existingCompIds = new Set(existingComps.map((c) => c.id));

  for (const comp of bundle.compositions || []) {
    if (mode === "merge" && existingCompIds.has(comp.id)) {
      result.compositionsSkipped++;
    } else {
      await idbPut(STORE_COMPOSITIONS, comp);
      result.compositionsAdded++;
    }
  }

  return result;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
