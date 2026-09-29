import type { StoredSnapshot } from "./types";

const SNAPSHOT_KEY = "ig-cleanup:snapshot:v1";
const KEEP_KEY = "ig-cleanup:keep:v1";

export function loadSnapshot(): StoredSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as StoredSnapshot) : null;
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: StoredSnapshot): boolean {
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearSnapshot() {
  try {
    window.localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    // In-memory state still resets when browser storage is unavailable.
  }
}

export function loadKeepList(): Set<string> {
  try {
    const raw = window.localStorage.getItem(KEEP_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(list);
  } catch {
    return new Set();
  }
}

export function saveKeepList(keep: Set<string>) {
  try {
    window.localStorage.setItem(KEEP_KEY, JSON.stringify(Array.from(keep)));
  } catch {
    // Keep the current in-memory state when browser storage is unavailable.
  }
}
