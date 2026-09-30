"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import {
  buildRelationshipBuckets,
  normalizeUsername,
  summarizeRelationships,
} from "@/features/instagram-data/compare";
import { diffRelationships, totalRelationshipChanges } from "@/features/instagram-data/diff";
import {
  parseInstagramFilesDetailed,
} from "@/features/instagram-data/parser";
import type {
  DetailedImportResult,
  ImportProgress,
} from "@/features/instagram-data/parser";
import { downloadBackup, parseBackupText } from "@/features/instagram-data/backup";
import {
  clearAllLocalState,
  clearImportHistory,
  clearKeepList,
  clearLastSessionSummary,
  clearReviewSession,
  clearReviewedList,
  clearSnapshot,
  loadImportHistory,
  loadKeepList,
  loadLastSessionSummary,
  loadReviewSession,
  migrateLocalState,
  loadReviewedList,
  loadSnapshot,
  saveImportHistory,
  saveKeepList,
  saveLastSessionSummary,
  saveReviewSession,
  saveReviewedList,
  saveSnapshot,
} from "@/features/instagram-data/storage";
import type {
  AppBackupV1,
  ImportHistoryEntry,
  InstagramAccount,
  InstagramRelationshipData,
  RelationshipDiff,
  ReviewSession,
  SessionSummary,
  SortOption,
} from "@/features/instagram-data/types";

import { AppSkeleton } from "./app-skeleton";
import { BottomNav } from "./bottom-nav";
import type { AppView } from "./bottom-nav";
import { ConfirmSheet } from "./confirm-sheet";
import { HomeView } from "./home-view";
import { ImportPreviewSheet } from "./import-preview-sheet";
import { ListView } from "./list-view";
import type { CleanupFilter, FollowingFilter } from "./list-view";
import { ReviewSheet } from "./review-sheet";
import { SettingsView } from "./settings-view";

const EMPTY: InstagramRelationshipData = { followers: [], following: [] };
const EMPTY_DIFF: RelationshipDiff = {
  newFollowers: [],
  lostFollowers: [],
  newFollowing: [],
  removedFollowing: [],
};

type PendingImport = {
  result: DetailedImportResult;
  diff: RelationshipDiff;
  importedAt: string;
};

type UndoAction = {
  kind: "keep" | "reviewed";
  username: string;
  sessionBefore: ReviewSession | null;
};

type ConfirmKind = "delete-data" | "clear-keep" | "clear-reviewed" | "reset-all";

const viewTitles: Record<AppView, { eyebrow: string; title: string }> = {
  home: { eyebrow: "Private local review", title: "IG Cleanup" },
  following: { eyebrow: "Connections", title: "Following" },
  cleanup: { eyebrow: "Cleanup", title: "Not following back" },
  keep: { eyebrow: "Protected accounts", title: "Keep" },
  profile: { eyebrow: "Local data", title: "Settings" },
};

const progressPercent = (progress: ImportProgress) => {
  if (progress.stage === "opening") return Math.round((progress.current / Math.max(progress.total, 1)) * 20);
  if (progress.stage === "reading") return 20 + Math.round((progress.current / Math.max(progress.total, 1)) * 70);
  return 96;
};

const haptic = () => {
  if ("vibrate" in navigator) navigator.vibrate(8);
};

const sortAccounts = (accounts: InstagramAccount[], sort: SortOption) =>
  [...accounts].sort((a, b) => {
    const nameCompare = a.username.localeCompare(b.username, undefined, { sensitivity: "base" });
    if (sort === "az") return nameCompare;
    if (sort === "za") return -nameCompare;

    const aTime = a.timestamp;
    const bTime = b.timestamp;
    if (aTime == null && bTime == null) return nameCompare;
    if (aTime == null) return 1;
    if (bTime == null) return -1;
    return (sort === "newest" ? bTime - aTime : aTime - bTime) || nameCompare;
  });

const cloneSession = (session: ReviewSession | null): ReviewSession | null =>
  session ? {
    ...session,
    history: [...(session.history ?? [])],
    skipped: [...(session.skipped ?? [])],
  } : null;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getStorageUsageLabel = async () => {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return formatBytes(estimate?.usage ?? 0);
  } catch {
    return "Unavailable";
  }
};

export function CleanupApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<AppView>("home");
  const [data, setData] = useState<InstagramRelationshipData | null>(null);
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [lastSessionSummary, setLastSessionSummary] = useState<SessionSummary | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);
  const [selected, setSelected] = useState<InstagramAccount | null>(null);
  const [query, setQuery] = useState("");
  const [followingFilter, setFollowingFilter] = useState<FollowingFilter>("all");
  const [cleanupFilter, setCleanupFilter] = useState<CleanupFilter>("pending");
  const [sort, setSort] = useState<SortOption>("az");
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [hydrating, setHydrating] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [storageUsage, setStorageUsage] = useState("—");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      migrateLocalState();
      void loadSnapshot()
        .then((snapshot) => {
          if (cancelled) return;
          if (snapshot) {
            setData(snapshot.data);
            setImportedAt(snapshot.importedAt);
          }
          setKeep(loadKeepList());
          setReviewed(loadReviewedList());
          setReviewSession(loadReviewSession());
          setImportHistory(loadImportHistory());
          setLastSessionSummary(loadLastSessionSummary());
          void getStorageUsageLabel().then((label) => { if (!cancelled) setStorageUsage(label); });
        })
        .finally(() => {
          if (!cancelled) setHydrating(false);
        });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selected && !pendingImport && !confirmKind) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSelected(null);
      setPendingImport(null);
      setConfirmKind(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmKind, pendingImport, selected]);

  const safeData = data ?? EMPTY;
  const summary = useMemo(() => summarizeRelationships(safeData), [safeData]);
  const buckets = useMemo(() => buildRelationshipBuckets(safeData), [safeData]);

  const followerSet = useMemo(
    () => new Set(safeData.followers.map((item) => normalizeUsername(item.username))),
    [safeData.followers],
  );

  const reviewAccounts = useMemo(
    () => buckets.notFollowingBack.filter((account) => {
      const key = normalizeUsername(account.username);
      return !keep.has(key) && !reviewed.has(key);
    }),
    [buckets.notFollowingBack, keep, reviewed],
  );

  const reviewedAccounts = useMemo(
    () => buckets.notFollowingBack.filter((account) => reviewed.has(normalizeUsername(account.username))),
    [buckets.notFollowingBack, reviewed],
  );

  const keepAccounts = useMemo(() => {
    const seen = new Set<string>();
    return [...safeData.following, ...safeData.followers].filter((account) => {
      const key = normalizeUsername(account.username);
      if (!keep.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [keep, safeData.followers, safeData.following]);

  const filteredFollowing = useMemo(() => {
    if (followingFilter === "not-back") return buckets.notFollowingBack;
    if (followingFilter === "mutual") return buckets.mutual;
    return safeData.following;
  }, [buckets.mutual, buckets.notFollowingBack, followingFilter, safeData.following]);

  const baseList = useMemo(() => {
    if (view === "following") return filteredFollowing;
    if (view === "cleanup") return cleanupFilter === "reviewed" ? reviewedAccounts : reviewAccounts;
    if (view === "keep") return keepAccounts;
    return [];
  }, [cleanupFilter, filteredFollowing, keepAccounts, reviewAccounts, reviewedAccounts, view]);

  const sortedBaseList = useMemo(() => sortAccounts(baseList, sort), [baseList, sort]);
  const visibleList = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery
      ? sortedBaseList.filter((account) => account.username.toLowerCase().includes(normalizedQuery))
      : sortedBaseList;
  }, [query, sortedBaseList]);

  const sessionAccount = useMemo(() => {
    if (!reviewSession) return null;
    return reviewAccounts.find((account) => normalizeUsername(account.username) === reviewSession.currentUsername) ?? null;
  }, [reviewAccounts, reviewSession]);

  const sessionProgress = reviewSession && sessionAccount
    ? { position: reviewSession.position, total: reviewSession.total }
    : null;

  const switchView = (next: AppView) => {
    if (importing) return;
    setView(next);
    setQuery("");
    setMessage(null);
    setBatchMode(false);
    setBatchSelected(new Set());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const importEntry = (
    result: DetailedImportResult,
    diff: RelationshipDiff,
    stamp: string,
  ): ImportHistoryEntry => ({
    id: stamp,
    importedAt: stamp,
    previousImportedAt: importedAt ?? undefined,
    followers: result.data.followers.length,
    following: result.data.following.length,
    changes: {
      newFollowers: diff.newFollowers.length,
      lostFollowers: diff.lostFollowers.length,
      newFollowing: diff.newFollowing.length,
      removedFollowing: diff.removedFollowing.length,
    },
    diagnostics: result.diagnostics,
  });

  const applyImport = async (pending: PendingImport) => {
    const { result, diff, importedAt: stamp } = pending;
    const nextHistory = [importEntry(result, diff, stamp), ...importHistory].slice(0, 20);
    const saved = await saveSnapshot({ data: result.data, importedAt: stamp });
    saveImportHistory(nextHistory);

    const nextBuckets = buildRelationshipBuckets(result.data);
    const nextReviewKeys = new Set(
      nextBuckets.notFollowingBack
        .map((account) => normalizeUsername(account.username))
        .filter((key) => !keep.has(key) && !reviewed.has(key)),
    );
    if (reviewSession && !nextReviewKeys.has(reviewSession.currentUsername)) {
      clearReviewSession();
      setReviewSession(null);
      setSelected(null);
    }

    setData(result.data);
    setImportedAt(stamp);
    setImportHistory(nextHistory);
    setPendingImport(null);
    setUndoAction(null);
    setView("home");
    setMessage(
      `${data ? "Update" : "Import"} complete · ${totalRelationshipChanges(diff)} relationship changes${saved ? "" : " · session-only storage"}.`,
    );
    void getStorageUsageLabel().then(setStorageUsage);
    haptic();
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    setImporting(true);
    setImportProgress({ stage: "opening", current: 0, total: files.length, label: "Preparing Instagram export" });
    setMessage(null);

    try {
      const result = await parseInstagramFilesDetailed(files, setImportProgress);
      const stamp = new Date().toISOString();
      const diff = data ? diffRelationships(safeData, result.data) : EMPTY_DIFF;
      const pending = { result, diff, importedAt: stamp };
      if (data) setPendingImport(pending);
      else await applyImport(pending);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read this Instagram export.");
    } finally {
      setImportProgress(null);
      setImporting(false);
      event.target.value = "";
    }
  };

  const finishSession = (session: ReviewSession) => {
    const summaryValue: SessionSummary = {
      finishedAt: new Date().toISOString(),
      total: session.total,
      reviewed: session.reviewedCount ?? 0,
      kept: session.keptCount ?? 0,
      skipped: new Set(session.skipped ?? []).size,
    };
    saveLastSessionSummary(summaryValue);
    clearReviewSession();
    setLastSessionSummary(summaryValue);
    setReviewSession(null);
    setSelected(null);
    setMessage("Review session finished. Skipped accounts stay in the queue.");
  };

  const advanceSession = (
    currentUsername: string,
    mode: "next" | "skip" | "action",
    stat?: "reviewed" | "keep",
  ) => {
    if (!reviewSession) return;
    const queue = sortAccounts(reviewAccounts, reviewSession.sort);
    const currentKey = normalizeUsername(currentUsername);
    const currentIndex = queue.findIndex((account) => normalizeUsername(account.username) === currentKey);
    const nextAccount = currentIndex >= 0 ? queue[currentIndex + 1] : queue[0];
    const nextSession: ReviewSession = {
      ...reviewSession,
      history: mode === "action" ? [...(reviewSession.history ?? [])] : [...(reviewSession.history ?? []), currentKey],
      skipped: mode === "skip" ? [...(reviewSession.skipped ?? []), currentKey] : [...(reviewSession.skipped ?? [])],
      reviewedCount: (reviewSession.reviewedCount ?? 0) + (stat === "reviewed" ? 1 : 0),
      keptCount: (reviewSession.keptCount ?? 0) + (stat === "keep" ? 1 : 0),
    };

    if (!nextAccount || reviewSession.position >= reviewSession.total) {
      finishSession(nextSession);
      return;
    }

    nextSession.currentUsername = normalizeUsername(nextAccount.username);
    nextSession.position = Math.min(reviewSession.position + 1, reviewSession.total);
    saveReviewSession(nextSession);
    setReviewSession(nextSession);
    setSelected(nextAccount);
    haptic();
  };

  const startOrResumeSession = () => {
    if (reviewSession && sessionAccount) {
      setView("cleanup");
      setCleanupFilter("pending");
      setSelected(sessionAccount);
      return;
    }

    if (reviewSession) {
      clearReviewSession();
      setReviewSession(null);
    }

    const queue = sortAccounts(reviewAccounts, sort);
    if (!queue.length) return;
    const nextSession: ReviewSession = {
      currentUsername: normalizeUsername(queue[0].username),
      position: 1,
      total: queue.length,
      sort,
      startedAt: new Date().toISOString(),
      history: [],
      skipped: [],
      reviewedCount: 0,
      keptCount: 0,
    };
    saveReviewSession(nextSession);
    setReviewSession(nextSession);
    setView("cleanup");
    setCleanupFilter("pending");
    setQuery("");
    setBatchMode(false);
    setBatchSelected(new Set());
    setSelected(queue[0]);
    haptic();
  };

  const previousSessionAccount = () => {
    if (!reviewSession) return;
    const history = [...(reviewSession.history ?? [])];
    while (history.length) {
      const previousKey = history.pop();
      if (!previousKey) break;
      const account = reviewAccounts.find((item) => normalizeUsername(item.username) === previousKey);
      if (!account) continue;
      const skipped = (reviewSession.skipped ?? []).filter((key) => key !== previousKey);
      const previousSession: ReviewSession = {
        ...reviewSession,
        currentUsername: previousKey,
        position: Math.max(1, reviewSession.position - 1),
        history,
        skipped,
      };
      saveReviewSession(previousSession);
      setReviewSession(previousSession);
      setSelected(account);
      haptic();
      return;
    }
  };

  const toggleKeep = (username: string) => {
    const key = normalizeUsername(username);
    const wasKept = keep.has(key);
    const sessionBefore = cloneSession(reviewSession);
    setKeep((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveKeepList(next);
      return next;
    });

    if (!wasKept) setUndoAction({ kind: "keep", username: key, sessionBefore });
    if (!wasKept && reviewSession?.currentUsername === key) advanceSession(username, "action", "keep");
    else haptic();
  };

  const toggleReviewed = (username: string) => {
    const key = normalizeUsername(username);
    const wasReviewed = reviewed.has(key);
    const sessionBefore = cloneSession(reviewSession);
    setReviewed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveReviewedList(next);
      return next;
    });

    if (!wasReviewed) setUndoAction({ kind: "reviewed", username: key, sessionBefore });
    if (!wasReviewed && reviewSession?.currentUsername === key) advanceSession(username, "action", "reviewed");
    else haptic();
  };

  const undoLastAction = () => {
    if (!undoAction) return;
    const { kind, username, sessionBefore } = undoAction;
    if (kind === "keep") {
      setKeep((current) => {
        const next = new Set(current);
        next.delete(username);
        saveKeepList(next);
        return next;
      });
    } else {
      setReviewed((current) => {
        const next = new Set(current);
        next.delete(username);
        saveReviewedList(next);
        return next;
      });
    }

    if (sessionBefore) {
      saveReviewSession(sessionBefore);
      setReviewSession(sessionBefore);
      const account = buckets.notFollowingBack.find((item) => normalizeUsername(item.username) === username);
      if (account) setSelected(account);
    }
    setUndoAction(null);
    setMessage("Last cleanup action undone.");
    haptic();
  };

  const toggleBatchSelected = (account: InstagramAccount) => {
    const key = normalizeUsername(account.username);
    setBatchSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleBatchMode = () => {
    setBatchMode((current) => !current);
    setBatchSelected(new Set());
  };

  const clearSessionIfBatchTouchesCurrent = () => {
    if (reviewSession && batchSelected.has(reviewSession.currentUsername)) {
      clearReviewSession();
      setReviewSession(null);
      setSelected(null);
    }
  };

  const applyBatchKeep = () => {
    if (!batchSelected.size) return;
    clearSessionIfBatchTouchesCurrent();
    setKeep((current) => {
      const next = new Set(current);
      batchSelected.forEach((key) => next.add(key));
      saveKeepList(next);
      return next;
    });
    setBatchSelected(new Set());
    setBatchMode(false);
    haptic();
  };

  const applyBatchReviewed = () => {
    if (!batchSelected.size) return;
    clearSessionIfBatchTouchesCurrent();
    setReviewed((current) => {
      const next = new Set(current);
      batchSelected.forEach((key) => next.add(key));
      saveReviewedList(next);
      return next;
    });
    setBatchSelected(new Set());
    setBatchMode(false);
    haptic();
  };

  const exportBackup = () => {
    const backup: AppBackupV1 = {
      version: 1,
      exportedAt: new Date().toISOString(),
      snapshot: data && importedAt ? { data, importedAt } : null,
      keep: Array.from(keep),
      reviewed: Array.from(reviewed),
      importHistory,
      reviewSession,
      lastSessionSummary,
    };
    downloadBackup(backup);
    setMessage("Backup exported locally.");
  };

  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = parseBackupText(await file.text());
      if (backup.snapshot) await saveSnapshot(backup.snapshot); else await clearSnapshot();
      const nextKeep = new Set(backup.keep.map(normalizeUsername));
      const nextReviewed = new Set(backup.reviewed.map(normalizeUsername));
      saveKeepList(nextKeep);
      saveReviewedList(nextReviewed);
      saveImportHistory(backup.importHistory);
      if (backup.reviewSession) saveReviewSession(backup.reviewSession); else clearReviewSession();
      if (backup.lastSessionSummary) saveLastSessionSummary(backup.lastSessionSummary); else clearLastSessionSummary();

      setData(backup.snapshot?.data ?? null);
      setImportedAt(backup.snapshot?.importedAt ?? null);
      setKeep(nextKeep);
      setReviewed(nextReviewed);
      setImportHistory(backup.importHistory);
      setReviewSession(backup.reviewSession);
      setLastSessionSummary(backup.lastSessionSummary);
      setSelected(null);
      setView("home");
      setMessage("Backup restored successfully.");
      void getStorageUsageLabel().then(setStorageUsage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not restore this backup.");
    } finally {
      event.target.value = "";
    }
  };

  const executeConfirm = async () => {
    const kind = confirmKind;
    setConfirmKind(null);
    if (!kind) return;

    if (kind === "clear-keep") {
      clearKeepList();
      setKeep(new Set());
      setMessage("Keep list cleared.");
    } else if (kind === "clear-reviewed") {
      clearReviewedList();
      clearReviewSession();
      setReviewed(new Set());
      setReviewSession(null);
      setSelected(null);
      setMessage("Reviewed history reset.");
    } else if (kind === "delete-data") {
      await clearSnapshot();
      clearImportHistory();
      clearReviewSession();
      setData(null);
      setImportedAt(null);
      setImportHistory([]);
      setReviewSession(null);
      setSelected(null);
      setView("home");
      setMessage("Imported relationship data deleted. Keep and Reviewed were preserved.");
    } else {
      await clearAllLocalState();
      setData(null);
      setImportedAt(null);
      setKeep(new Set());
      setReviewed(new Set());
      setImportHistory([]);
      setReviewSession(null);
      setLastSessionSummary(null);
      setSelected(null);
      setUndoAction(null);
      setView("home");
      setMessage("All IG Cleanup data was removed from this device.");
    }
    void getStorageUsageLabel().then(setStorageUsage);
  };

  const confirmCopy = confirmKind ? {
    "delete-data": {
      title: "Delete imported data?",
      description: "This removes the Instagram relationship snapshot and import history. Keep and Reviewed lists stay on this device.",
      confirmLabel: "Delete imported data",
    },
    "clear-keep": {
      title: "Clear Keep list?",
      description: "Protected accounts can return to the cleanup queue if they do not follow you back.",
      confirmLabel: "Clear Keep",
    },
    "clear-reviewed": {
      title: "Reset Reviewed?",
      description: "Reviewed accounts return to the cleanup queue and the active review session is cleared.",
      confirmLabel: "Reset Reviewed",
    },
    "reset-all": {
      title: "Reset everything?",
      description: "This permanently removes imported data, Keep, Reviewed, history, backups state, and review-session progress from this browser.",
      confirmLabel: "Reset everything",
    },
  }[confirmKind] : null;

  const openImporter = () => { if (!importing) fileInputRef.current?.click(); };
  const hasData = Boolean(data);
  const title = viewTitles[view];
  const selectedKey = selected ? normalizeUsername(selected.username) : "";
  const selectedKept = selected ? keep.has(selectedKey) : false;
  const selectedReviewed = selected ? reviewed.has(selectedKey) : false;
  const selectedFollowsYou = selected ? followerSet.has(selectedKey) : false;
  const canGoPrevious = Boolean(reviewSession?.history?.length);
  const lastImport = importHistory[0] ?? null;

  return (
    <main className="appShell" aria-busy={hydrating || importing}>
      <input ref={fileInputRef} className="visuallyHidden" type="file" accept=".zip,.json,.html,.htm,application/zip,application/json,text/html" multiple onChange={handleImport} />
      <input ref={backupInputRef} className="visuallyHidden" type="file" accept=".json,application/json" onChange={restoreBackup} />

      <header className="topBar">
        <div><h1>{title.title}</h1><span className="eyebrow">{title.eyebrow}</span></div>
        <button className="avatarButton" type="button" aria-label="Open settings" onClick={() => switchView("profile")} disabled={importing}>IG</button>
      </header>

      {importProgress ? (
        <section className="importProgress" role="status" aria-live="polite">
          <div className="importProgressCopy"><strong>{importProgress.label}</strong><span>{progressPercent(importProgress)}%</span></div>
          <div className="importProgressTrack" aria-hidden="true"><span style={{ width: progressPercent(importProgress) + "%" }} /></div>
        </section>
      ) : message ? <div className="notice" role="status">{message}</div> : null}

      {undoAction && !selected ? (
        <div className="undoToast" role="status"><span>Last cleanup action saved.</span><button type="button" onClick={undoLastAction}>Undo</button></div>
      ) : null}

      {hydrating ? <AppSkeleton /> : (
        <>
          {view === "home" ? (
            <HomeView
              hasData={hasData}
              importing={importing}
              summary={summary}
              reviewCount={reviewAccounts.length}
              reviewedCount={reviewedAccounts.length}
              accounts={reviewAccounts.slice(0, 6)}
              followerSet={followerSet}
              onImport={openImporter}
              onReview={setSelected}
              onSeeAll={() => switchView("cleanup")}
              keep={keep}
              sessionProgress={sessionProgress}
              onStartSession={startOrResumeSession}
              lastImport={lastImport}
              lastSessionSummary={lastSessionSummary}
            />
          ) : null}

          {view === "following" || view === "cleanup" || view === "keep" ? (
            <ListView
              view={view}
              hasData={hasData}
              query={query}
              onQuery={setQuery}
              accounts={visibleList}
              total={baseList.length}
              followerSet={followerSet}
              keep={keep}
              reviewed={reviewed}
              onReview={setSelected}
              onImport={openImporter}
              followingFilter={followingFilter}
              onFollowingFilter={setFollowingFilter}
              cleanupFilter={cleanupFilter}
              onCleanupFilter={setCleanupFilter}
              sort={sort}
              onSort={(nextSort) => { setSort(nextSort); setBatchSelected(new Set()); }}
              batchMode={batchMode}
              selectedKeys={batchSelected}
              onToggleBatchMode={toggleBatchMode}
              onToggleSelected={toggleBatchSelected}
              onBatchKeep={applyBatchKeep}
              onBatchReviewed={applyBatchReviewed}
              onStartSession={startOrResumeSession}
              sessionProgress={sessionProgress}
            />
          ) : null}

          {view === "profile" ? (
            <SettingsView
              hasData={hasData}
              summary={summary}
              importedAt={importedAt}
              keepCount={keep.size}
              reviewedCount={reviewedAccounts.length}
              importHistoryCount={importHistory.length}
              importing={importing}
              storageUsage={storageUsage}
              onImport={openImporter}
              onExportBackup={exportBackup}
              onRestoreBackup={() => backupInputRef.current?.click()}
              onDeleteData={() => setConfirmKind("delete-data")}
              onClearKeep={() => setConfirmKind("clear-keep")}
              onClearReviewed={() => setConfirmKind("clear-reviewed")}
              onResetAll={() => setConfirmKind("reset-all")}
            />
          ) : null}
        </>
      )}

      <BottomNav active={view} onChange={switchView} />

      {selected ? (
        <ReviewSheet
          account={selected}
          followsYou={selectedFollowsYou}
          kept={selectedKept}
          reviewed={selectedReviewed}
          sessionProgress={sessionProgress}
          canGoPrevious={canGoPrevious}
          canUndo={Boolean(undoAction)}
          onClose={() => setSelected(null)}
          onNext={sessionProgress ? () => advanceSession(selected.username, "next") : undefined}
          onPrevious={sessionProgress ? previousSessionAccount : undefined}
          onSkip={sessionProgress ? () => advanceSession(selected.username, "skip") : undefined}
          onUndo={undoLastAction}
          onToggleKeep={toggleKeep}
          onToggleReviewed={toggleReviewed}
        />
      ) : null}

      {pendingImport ? (
        <ImportPreviewSheet
          result={pendingImport.result}
          diff={pendingImport.diff}
          previousImportedAt={importedAt}
          onApply={() => void applyImport(pendingImport)}
          onCancel={() => setPendingImport(null)}
        />
      ) : null}

      {confirmCopy ? (
        <ConfirmSheet
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          danger
          onConfirm={() => void executeConfirm()}
          onCancel={() => setConfirmKind(null)}
        />
      ) : null}
    </main>
  );
}
