import type {
  ImportHistoryEntry,
  ReviewSession,
  SessionSummary,
  StoredSnapshot,
} from "./types";

const DB_NAME = "ig-cleanup";
const DB_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const SNAPSHOT_ID = "latest";
const LEGACY_SNAPSHOT_KEY = "ig-cleanup:snapshot:v1";
const KEEP_KEY = "ig-cleanup:keep:v1";
const REVIEWED_KEY = "ig-cleanup:reviewed:v1";
const SESSION_KEY = "ig-cleanup:review-session:v1";
const IMPORT_HISTORY_KEY = "ig-cleanup:import-history:v1";
const LAST_SESSION_KEY = "ig-cleanup:last-session:v1";
const DATA_VERSION_KEY = "ig-cleanup:data-version";
const CURRENT_DATA_VERSION = 2;

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

const loadJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const saveJson = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep in-memory state if storage is unavailable.
  }
};

const removeLocal = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // In-memory state can still reset.
  }
};

const loadStringSet = (key: string): Set<string> =>
  new Set(loadJson<string[]>(key, []));

const saveStringSet = (key: string, values: Set<string>) =>
  saveJson(key, Array.from(values));

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

export function clearKeepList() {
  removeLocal(KEEP_KEY);
}

export function loadReviewedList(): Set<string> {
  return loadStringSet(REVIEWED_KEY);
}

export function saveReviewedList(reviewed: Set<string>) {
  saveStringSet(REVIEWED_KEY, reviewed);
}

export function clearReviewedList() {
  removeLocal(REVIEWED_KEY);
}

export function loadReviewSession(): ReviewSession | null {
  return loadJson<ReviewSession | null>(SESSION_KEY, null);
}

export function saveReviewSession(session: ReviewSession) {
  saveJson(SESSION_KEY, session);
}

export function clearReviewSession() {
  removeLocal(SESSION_KEY);
}

export function loadImportHistory(): ImportHistoryEntry[] {
  return loadJson<ImportHistoryEntry[]>(IMPORT_HISTORY_KEY, []);
}

export function saveImportHistory(history: ImportHistoryEntry[]) {
  saveJson(IMPORT_HISTORY_KEY, history.slice(0, 20));
}

export function clearImportHistory() {
  removeLocal(IMPORT_HISTORY_KEY);
}

export function loadLastSessionSummary(): SessionSummary | null {
  return loadJson<SessionSummary | null>(LAST_SESSION_KEY, null);
}

export function saveLastSessionSummary(summary: SessionSummary) {
  saveJson(LAST_SESSION_KEY, summary);
}

export function clearLastSessionSummary() {
  removeLocal(LAST_SESSION_KEY);
}

export async function clearAllLocalState() {
  await clearSnapshot();
  [
    KEEP_KEY,
    REVIEWED_KEY,
    SESSION_KEY,
    IMPORT_HISTORY_KEY,
    LAST_SESSION_KEY,
    LEGACY_SNAPSHOT_KEY,
    DATA_VERSION_KEY,
  ].forEach(removeLocal);
}

export function migrateLocalState() {
  try {
    const version = Number(window.localStorage.getItem(DATA_VERSION_KEY) ?? "1");
    if (version < 2) {
      const session = loadReviewSession();
      if (session) {
        saveReviewSession({
          ...session,
          history: session.history ?? [],
          skipped: session.skipped ?? [],
          reviewedCount: session.reviewedCount ?? 0,
          keptCount: session.keptCount ?? 0,
        });
      }
    }
    window.localStorage.setItem(DATA_VERSION_KEY, String(CURRENT_DATA_VERSION));
  } catch {
    // Migration is best-effort; existing data remains readable.
  }
}
