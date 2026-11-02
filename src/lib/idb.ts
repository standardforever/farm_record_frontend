/**
 * A tiny key-value store on IndexedDB (survives closing the browser; holds photos as Blobs).
 *
 * Falls back to memory when IndexedDB is missing or blocked (private mode on some phones), so callers
 * never need to care. Two stores: "queue" (work waiting to be sent) and "cache" (data shown offline).
 */

type StoreName = "queue" | "cache";
const DB = "oko";
const VERSION = 1;
const memory: Record<StoreName, Map<string, unknown>> = { queue: new Map(), cache: new Map() };

let opening: Promise<IDBDatabase | null> | null = null;
function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        for (const s of ["queue", "cache"]) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return opening;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then((db) => new Promise<T | undefined>((resolve) => {
    if (!db) return resolve(undefined);
    try {
      const req = fn(db.transaction(store, mode).objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch { resolve(undefined); }
  }));
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return memory[store].get(key) as T | undefined;
  return run<T>(store, "readonly", (s) => s.get(key) as IDBRequest<T>);
}

export async function idbSet(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await open();
  if (!db) { memory[store].set(key, value); return; }
  await run(store, "readwrite", (s) => s.put(value, key));
}

export async function idbDel(store: StoreName, key: string): Promise<void> {
  const db = await open();
  if (!db) { memory[store].delete(key); return; }
  await run(store, "readwrite", (s) => s.delete(key));
}

/** Every value in a store whose key starts with `prefix`. */
export async function idbAll<T>(store: StoreName, prefix = ""): Promise<T[]> {
  const db = await open();
  if (!db) return [...memory[store].entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v as T);
  const range = prefix ? IDBKeyRange.bound(prefix, prefix + "￿") : undefined;
  return (await run<T[]>(store, "readonly", (s) => s.getAll(range) as IDBRequest<T[]>)) ?? [];
}

export async function idbClear(store: StoreName): Promise<void> {
  const db = await open();
  if (!db) { memory[store].clear(); return; }
  await run(store, "readwrite", (s) => s.clear());
}
