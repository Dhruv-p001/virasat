import type { CaptureUploadApi, PendingCapture } from "@virasat/core";
import {
  confirmCapture,
  refreshCapture,
  startCapture,
} from "@/app/vault/[familyId]/people/[personId]/capture/actions.ts";
import { putToSignedUrl } from "./storage-put.ts";

// Browser side of the organiser's capture upload: a recording or a set of pages waits in IndexedDB
// until the server has confirmed it (ADR 0012, 0014). If IndexedDB is unavailable (some private
// modes), it waits in memory instead and the upload still retries.

const DB_NAME = "virasat-organiser-captures";
const STORE = "pending";

export type Pending = PendingCapture<Blob>;

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

/** Captures for this person that the server has not confirmed yet. */
export async function listPending(personId: string): Promise<Pending[]> {
  let stored: Pending[] = [];
  try {
    stored = await withStore("readonly", (store) => store.getAll() as IDBRequest<Pending[]>);
  } catch {
    // Fall through to memory.
  }
  const byId = new Map(stored.map((entry) => [entry.id, entry]));
  for (const [id, entry] of memory) byId.set(id, entry);
  return [...byId.values()].filter((entry) => entry.personId === personId);
}

/** Resolves after `ms`, or sooner when the connection comes back. */
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

export const captureApi: CaptureUploadApi<Blob> = {
  begin: (personId, source, files) => startCapture(personId, source, files),
  refresh: (jobId) => refreshCapture(jobId),
  put: putToSignedUrl,
  confirm: (jobId) => confirmCapture(jobId),
};
