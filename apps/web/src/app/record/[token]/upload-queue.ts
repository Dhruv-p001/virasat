import type { PendingUpload, UploadApi } from "@virasat/core";
import { confirmUpload, refreshUpload, startUpload } from "./actions.ts";

// Browser side of the elder's upload: recordings wait in IndexedDB until the server has
// confirmed them (ADR 0012). If IndexedDB is unavailable (some private modes), they wait in
// memory instead and the page says nothing different: the upload still retries.

const DB_NAME = "virasat-recordings";
const STORE = "pending";

export type Pending = PendingUpload<Blob>;

const memory = new Map<string, Pending>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB failed"));
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("IndexedDB failed"));
      };
    });
  } finally {
    db.close();
  }
}

export async function savePending(entry: Pending): Promise<void> {
  memory.set(entry.id, entry);
  try {
    await withStore("readwrite", (store) => store.put(entry));
  } catch {
    // Memory copy above is the fallback.
  }
}

export async function removePending(id: string): Promise<void> {
  memory.delete(id);
  try {
    await withStore("readwrite", (store) => store.delete(id));
  } catch {
    // Nothing stored to remove.
  }
}

/** Recordings for this link that the server has not confirmed yet. */
export async function listPending(token: string): Promise<Pending[]> {
  let stored: Pending[] = [];
  try {
    stored = await withStore("readonly", (store) => store.getAll() as IDBRequest<Pending[]>);
  } catch {
    // Fall through to memory.
  }
  const byId = new Map(stored.map((entry) => [entry.id, entry]));
  for (const [id, entry] of memory) byId.set(id, entry);
  return [...byId.values()].filter((entry) => entry.token === token);
}

/** Resolves after `ms`, or sooner when the phone gets its connection back. */
export function sleepUntilOnline(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener("online", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    window.addEventListener("online", done);
  });
}

/** The recording goes to storage as a plain multipart PUT, as the storage client itself does. */
async function putToSignedUrl(
  url: string,
  blob: Blob,
  mime: string,
): Promise<"ok" | "exists" | "expired"> {
  const body = new FormData();
  body.append("cacheControl", "3600");
  // Plain mime type: the bucket's allow-list has no codec parameters.
  body.append("", new Blob([blob], { type: mime }));
  const response = await fetch(url, { method: "PUT", body });
  if (response.ok) return "ok";
  if (response.status === 409) return "exists";
  if (response.status >= 400 && response.status < 500) return "expired";
  throw new Error(`Upload failed (${response.status})`);
}

export const uploadApi: UploadApi<Blob> = {
  start: (token, mime, size) => startUpload(token, mime, size),
  refresh: (token, jobId) => refreshUpload(token, jobId),
  put: putToSignedUrl,
  confirm: (token, jobId) => confirmUpload(token, jobId),
};
