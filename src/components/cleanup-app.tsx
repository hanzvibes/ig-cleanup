"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import {
  buildRelationshipBuckets,
  normalizeUsername,
  summarizeRelationships,
} from "@/features/instagram-data/compare";
import { parseInstagramFiles } from "@/features/instagram-data/parser";
import type { ImportProgress } from "@/features/instagram-data/parser";
import {
  clearReviewSession,
  clearReviewedList,
  clearSnapshot,
  loadKeepList,
  loadReviewSession,
  loadReviewedList,
  loadSnapshot,
  saveKeepList,
  saveReviewSession,
  saveReviewedList,
  saveSnapshot,
} from "@/features/instagram-data/storage";
import type {
  InstagramAccount,
  InstagramRelationshipData,
  ReviewSession,
  SortOption,
} from "@/features/instagram-data/types";

import { AppSkeleton } from "./app-skeleton";
import { BottomNav } from "./bottom-nav";
import type { AppView } from "./bottom-nav";
import { HomeView } from "./home-view";
import { ListView } from "./list-view";
import type { CleanupFilter, FollowingFilter } from "./list-view";
import { ReviewSheet } from "./review-sheet";
import { SettingsView } from "./settings-view";

const EMPTY: InstagramRelationshipData = { followers: [], following: [] };

const viewTitles: Record<AppView, { eyebrow: string; title: string }> = {
  home: { eyebrow: "Private local review", title: "IG Cleanup" },
  following: { eyebrow: "Connections", title: "Following" },
  cleanup: { eyebrow: "Cleanup", title: "Not following back" },
  keep: { eyebrow: "Protected accounts", title: "Keep" },
  profile: { eyebrow: "Local data", title: "Settings" },
};

const progressPercent = (progress: ImportProgress) => {
  if (progress.stage === "opening") {
    return Math.round((progress.current / Math.max(progress.total, 1)) * 20);
  }
  if (progress.stage === "reading") {
    return 20 + Math.round((progress.current / Math.max(progress.total, 1)) * 70);
  }
  return 96;
};

const haptic = () => {
  if ("vibrate" in navigator) navigator.vibrate(8);
};

const sortAccounts = (accounts: InstagramAccount[], sort: SortOption) => {
  return [...accounts].sort((a, b) => {
    const nameCompare = a.username.localeCompare(b.username, undefined, { sensitivity: "base" });

    if (sort === "az") return nameCompare;
    if (sort === "za") return -nameCompare;

    const aTime = a.timestamp;
    const bTime = b.timestamp;
    if (aTime == null && bTime == null) return nameCompare;
    if (aTime == null) return 1;
    if (bTime == null) return -1;

    const timeCompare = sort === "newest" ? bTime - aTime : aTime - bTime;
    return timeCompare || nameCompare;
  });
};

export function CleanupApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<AppView>("home");
  const [data, setData] = useState<InstagramRelationshipData | null>(null);
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const frame = window.requestAnimationFrame(() => {
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

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is progressive enhancement; app usage should never depend on it.
    });
  }, []);

  useEffect(() => {
    if (!selected) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selected]);

  const safeData = data ?? EMPTY;
  const summary = useMemo(() => summarizeRelationships(safeData), [safeData]);
  const buckets = useMemo(() => buildRelationshipBuckets(safeData), [safeData]);

  const followerSet = useMemo(
    () => new Set(safeData.followers.map((item) => normalizeUsername(item.username))),
    [safeData.followers],
  );

  const reviewAccounts = useMemo(
    () =>
      buckets.notFollowingBack.filter((account) => {
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
    const all = [...safeData.following, ...safeData.followers];
    const seen = new Set<string>();

    return all.filter((account) => {
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
    if (!normalizedQuery) return sortedBaseList;
    return sortedBaseList.filter((account) => account.username.toLowerCase().includes(normalizedQuery));
  }, [query, sortedBaseList]);

  const sessionAccount = useMemo(() => {
    if (!reviewSession) return null;
    return reviewAccounts.find(
      (account) => normalizeUsername(account.username) === reviewSession.currentUsername,
    ) ?? null;
  }, [reviewAccounts, reviewSession]);

  const sessionProgress = reviewSession && sessionAccount
    ? { position: reviewSession.position, total: reviewSession.total }
    : null;

  useEffect(() => {
    if (hydrating || !reviewSession || sessionAccount) return;

    if (reviewAccounts.length === 0) {
      clearReviewSession();
      setReviewSession(null);
      return;
    }

    const fallback = sortAccounts(reviewAccounts, reviewSession.sort)[0];
    const nextSession = {
      ...reviewSession,
      currentUsername: normalizeUsername(fallback.username),
      position: Math.min(reviewSession.position, reviewSession.total),
    };
    saveReviewSession(nextSession);
    setReviewSession(nextSession);
  }, [hydrating, reviewAccounts, reviewSession, sessionAccount]);

  const switchView = (next: AppView) => {
    if (importing) return;
    setView(next);
    setQuery("");
    setMessage(null);
    setBatchMode(false);
    setBatchSelected(new Set());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setImporting(true);
    setImportProgress({
      stage: "opening",
      current: 0,
      total: files.length,
      label: "Preparing Instagram export",
    });
    setMessage(null);

    try {
      const parsed = await parseInstagramFiles(files, setImportProgress);
      const stamp = new Date().toISOString();

      setImportProgress({
        stage: "finalizing",
        current: 1,
        total: 1,
        label: "Saving locally on this device",
      });

      setData(parsed);
      setImportedAt(stamp);

      const saved = await saveSnapshot({ data: parsed, importedAt: stamp });
      setMessage(
        saved
          ? "Import complete. Data stays on this device."
          : "Import complete for this session. Browser storage is full or unavailable.",
      );
      setView("home");
      haptic();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read this Instagram export.");
    } finally {
      setImportProgress(null);
      setImporting(false);
      event.target.value = "";
    }
  };

  const endSession = (messageText?: string) => {
    clearReviewSession();
    setReviewSession(null);
    setSelected(null);
    if (messageText) setMessage(messageText);
  };

  const advanceSession = (currentUsername: string) => {
    if (!reviewSession) return;

    const queue = sortAccounts(reviewAccounts, reviewSession.sort);
    const currentIndex = queue.findIndex(
      (account) => normalizeUsername(account.username) === normalizeUsername(currentUsername),
    );
    const nextAccount = currentIndex >= 0 ? queue[currentIndex + 1] : queue[0];

    if (!nextAccount || reviewSession.position >= reviewSession.total) {
      endSession("Review session finished. Remaining skipped accounts stay in the queue.");
      return;
    }

    const nextSession: ReviewSession = {
      ...reviewSession,
      currentUsername: normalizeUsername(nextAccount.username),
      position: Math.min(reviewSession.position + 1, reviewSession.total),
    };

    saveReviewSession(nextSession);
    setReviewSession(nextSession);
    setSelected(nextAccount);
    haptic();
  };

  const startOrResumeSession = () => {
    if (reviewSession && sessionAccount) {
      setView("cleanup");
      setCleanupFilter("pending");
      setQuery("");
      setBatchMode(false);
      setBatchSelected(new Set());
      setSelected(sessionAccount);
      return;
    }

    const queue = sortAccounts(reviewAccounts, sort);
    if (queue.length === 0) return;

    const nextSession: ReviewSession = {
      currentUsername: normalizeUsername(queue[0].username),
      position: 1,
      total: queue.length,
      sort,
      startedAt: new Date().toISOString(),
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

  const toggleKeep = (username: string) => {
    const key = normalizeUsername(username);
    const wasKept = keep.has(key);

    setKeep((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveKeepList(next);
      return next;
    });

    if (!wasKept && reviewSession?.currentUsername === key) advanceSession(username);
    else haptic();
  };

  const toggleReviewed = (username: string) => {
    const key = normalizeUsername(username);
    const wasReviewed = reviewed.has(key);

    setReviewed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveReviewedList(next);
      return next;
    });

    if (!wasReviewed && reviewSession?.currentUsername === key) advanceSession(username);
    else haptic();
  };

  const toggleBatchSelected = (account: InstagramAccount) => {
    const key = normalizeUsername(account.username);
    setBatchSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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
    if (batchSelected.size === 0) return;
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
    if (batchSelected.size === 0) return;
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

  const handleSort = (nextSort: SortOption) => {
    setSort(nextSort);
    setBatchSelected(new Set());
  };

  const resetReviewed = () => {
    clearReviewedList();
    clearReviewSession();
    setReviewed(new Set());
    setReviewSession(null);
    setSelected(null);
    setMessage("Reviewed history was reset.");
  };

  const resetData = () => {
    void clearSnapshot();
    clearReviewSession();
    setData(null);
    setImportedAt(null);
    setReviewSession(null);
    setSelected(null);
    setBatchMode(false);
    setBatchSelected(new Set());
    setMessage("Imported relationship data was removed from this device.");
    setView("home");
  };

  const openImporter = () => {
    if (!importing) fileInputRef.current?.click();
  };

  const hasData = Boolean(data);
  const title = viewTitles[view];
  const selectedKey = selected ? normalizeUsername(selected.username) : "";
  const selectedKept = selected ? keep.has(selectedKey) : false;
  const selectedReviewed = selected ? reviewed.has(selectedKey) : false;
  const selectedFollowsYou = selected ? followerSet.has(selectedKey) : false;
  const selectedSessionProgress = reviewSession?.currentUsername === selectedKey ? sessionProgress : null;

  return (
    <main className="appShell" aria-busy={hydrating || importing}>
      <input
        ref={fileInputRef}
        className="visuallyHidden"
        type="file"
        accept=".zip,.json,.html,.htm,application/zip,application/json,text/html"
        multiple
        onChange={handleImport}
      />

      <header className="topBar">
        <div>
          <h1>{title.title}</h1>
          <span className="eyebrow">{title.eyebrow}</span>
        </div>
        <button
          className="avatarButton"
          type="button"
          aria-label="Open settings"
          onClick={() => switchView("profile")}
          disabled={importing}
        >
          IG
        </button>
      </header>

      {importProgress ? (
        <section className="importProgress" role="status" aria-live="polite">
          <div className="importProgressCopy">
            <strong>{importProgress.label}</strong>
            <span>{progressPercent(importProgress)}%</span>
          </div>
          <div className="importProgressTrack" aria-hidden="true">
            <span style={{ width: progressPercent(importProgress) + "%" }} />
          </div>
        </section>
      ) : message ? (
        <div className="notice" role="status">{message}</div>
      ) : null}

      {hydrating ? (
        <AppSkeleton />
      ) : (
        <>
          {view === "home" ? (
            <HomeView
              hasData={hasData}
              importing={importing}
              summary={summary}
              reviewCount={reviewAccounts.length}
              reviewedCount={reviewedAccounts.length}
              accounts={sortAccounts(reviewAccounts, sort).slice(0, 6)}
              followerSet={followerSet}
              onImport={openImporter}
              onReview={setSelected}
              onSeeAll={() => switchView("cleanup")}
              keep={keep}
              sessionProgress={sessionProgress}
              onStartSession={startOrResumeSession}
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
              onCleanupFilter={(filter) => {
                setCleanupFilter(filter);
                setBatchMode(false);
                setBatchSelected(new Set());
              }}
              sort={sort}
              onSort={handleSort}
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
              importing={importing}
              onImport={openImporter}
              onReset={resetData}
              onClearReviewed={resetReviewed}
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
          sessionProgress={selectedSessionProgress}
          onClose={() => setSelected(null)}
          onNext={selectedSessionProgress ? () => advanceSession(selected.username) : undefined}
          onToggleKeep={toggleKeep}
          onToggleReviewed={toggleReviewed}
        />
      ) : null}
    </main>
  );
}
