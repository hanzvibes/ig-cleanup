import type { AppBackupV1 } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function parseBackupText(text: string): AppBackupV1 {
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error("This backup version is not supported.");
  }

  if (!Array.isArray(parsed.keep) || !Array.isArray(parsed.reviewed)) {
    throw new Error("This backup is missing Keep or Reviewed data.");
  }

  if (!Array.isArray(parsed.importHistory)) {
    throw new Error("This backup is missing import history.");
  }

  const snapshot = parsed.snapshot;
  if (snapshot !== null) {
    if (!isRecord(snapshot) || !isRecord(snapshot.data)) {
      throw new Error("This backup contains an invalid Instagram snapshot.");
    }
    const data = snapshot.data;
    if (!Array.isArray(data.followers) || !Array.isArray(data.following)) {
      throw new Error("This backup contains an invalid relationship snapshot.");
    }
  }

  return parsed as AppBackupV1;
}

export function downloadBackup(backup: AppBackupV1) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ig-cleanup-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
