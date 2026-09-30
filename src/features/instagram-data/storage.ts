import type { ReviewSession, StoredSnapshot } from "./types";

const DB_NAME = "ig-cleanup";
const DB_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const SNAPSHOT_ID = "latest";
const LEGACY_SNAPSHOT_KEY = "ig-cleanup:snapshot:v1";
const KEEP_KEY = "ig-cleanup:keep:v1";
const REVIEWED_KEY = "ig-cleanup:reviewed:v1";
const SESSION_KEY = "ig-cleanup:review-session:v1";

const canUseIndexedDb = () =>
  typeof window !== "undefined" && "indexedDB" in window;

const loadLegacySnapshot = (): StoredSnapshot | null => {
  try {
    const raw = window.localStorage.getItem(LEGACY_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as StoredSnapshot) : null;
  } catch {
    return null;
  }
};

const saveLegacySnapshot = (snapshot: StoredSnapshot): boolean => {
  try {
    window.localStorage.setItem(LEGACY_SNAPSHOT_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
};

const clearLegacySnapshot = () => {
  try {
    window.localStorage.removeItem(LEGACY_SNAPSHOT_KEY);
  } catch {
    // Nothing else to clear.
  }
};

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB."));
  });

const readIndexedSnapshot = async (): Promise<StoredSnapshot | null> => {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SNAPSHOT_STORE, "readonly");
    const request = transaction.objectStore(SNAPSHOT_STORE).get(SNAPSHOT_ID);

    request.onsuccess = () => {
      database.close();
      resolve((request.result as StoredSnapshot | undefined) ?? null);
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error("Could not read IndexedDB."));
    };
  });
};

const writeIndexedSnapshot = async (snapshot: StoredSnapshot) => {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
    transaction.objectStore(SNAPSHOT_STORE).put(snapshot, SNAPSHOT_ID);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not write IndexedDB."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB write was aborted."));
    };
  });
};

const deleteIndexedSnapshot = async () => {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
    transaction.objectStore(SNAPSHOT_STORE).delete(SNAPSHOT_ID);

    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not clear IndexedDB."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB clear was aborted."));
    };
  });
};

const loadStringSet = (key: string): Set<string> => {
  try {
    const raw = window.localStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(list);
  } catch {
    return new Set();
  }
};

const saveStringSet = (key: string, values: Set<string>) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(values)));
  } catch {
    // Preserve the current in-memory state if browser storage is unavailable.
  }
};

export async function loadSnapshot(): Promise<StoredSnapshot | null> {
  if (!canUseIndexedDb()) return loadLegacySnapshot();

  try {
    const indexed = await readIndexedSnapshot();
    if (indexed) return indexed;

    const legacy = loadLegacySnapshot();
    if (legacy) {
      await writeIndexedSnapshot(legacy);
      clearLegacySnapshot();
      return legacy;
    }

    return null;
  } catch {
    return loadLegacySnapshot();
  }
}

export async function saveSnapshot(snapshot: StoredSnapshot): Promise<boolean> {
  if (!canUseIndexedDb()) return saveLegacySnapshot(snapshot);

  try {
    await writeIndexedSnapshot(snapshot);
    clearLegacySnapshot();
    return true;
  } catch {
    return saveLegacySnapshot(snapshot);
  }
}

export async function clearSnapshot(): Promise<void> {
  clearLegacySnapshot();

  if (!canUseIndexedDb()) return;

  try {
    await deleteIndexedSnapshot();
  } catch {
    // The visible app state can still reset if browser storage is unavailable.
  }
}

export function loadKeepList(): Set<string> {
  return loadStringSet(KEEP_KEY);
}

export function saveKeepList(keep: Set<string>) {
  saveStringSet(KEEP_KEY, keep);
}

export function loadReviewedList(): Set<string> {
  return loadStringSet(REVIEWED_KEY);
}

export function saveReviewedList(reviewed: Set<string>) {
  saveStringSet(REVIEWED_KEY, reviewed);
}

export function clearReviewedList() {
  try {
    window.localStorage.removeItem(REVIEWED_KEY);
  } catch {
    // In-memory state still resets.
  }
}

export function loadReviewSession(): ReviewSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ReviewSession) : null;
  } catch {
    return null;
  }
}

export function saveReviewSession(session: ReviewSession) {
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Session resume is optional when storage is unavailable.
  }
}

export function clearReviewSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // In-memory state still resets.
  }
}
