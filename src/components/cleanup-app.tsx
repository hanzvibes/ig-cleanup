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
  clearReviewedList,
  clearSnapshot,
  loadKeepList,
  loadReviewedList,
  loadSnapshot,
  saveKeepList,
  saveReviewedList,
  saveSnapshot,
} from "@/features/instagram-data/storage";
import type { InstagramAccount, InstagramRelationshipData } from "@/features/instagram-data/types";

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

export function CleanupApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<AppView>("home");
  const [data, setData] = useState<InstagramRelationshipData | null>(null);
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<InstagramAccount | null>(null);
  const [query, setQuery] = useState("");
  const [followingFilter, setFollowingFilter] = useState<FollowingFilter>("all");
  const [cleanupFilter, setCleanupFilter] = useState<CleanupFilter>("pending");
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

  const visibleList = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return baseList;
    return baseList.filter((account) => account.username.toLowerCase().includes(normalizedQuery));
  }, [baseList, query]);

  const switchView = (next: AppView) => {
    if (importing) return;
    setView(next);
    setQuery("");
    setMessage(null);
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

  const toggleKeep = (username: string) => {
    const key = normalizeUsername(username);

    setKeep((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveKeepList(next);
      return next;
    });
    haptic();
  };

  const toggleReviewed = (username: string) => {
    const key = normalizeUsername(username);

    setReviewed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveReviewedList(next);
      return next;
    });
    haptic();
  };

  const resetReviewed = () => {
    clearReviewedList();
    setReviewed(new Set());
    setMessage("Reviewed history was reset.");
  };

  const resetData = () => {
    void clearSnapshot();
    setData(null);
    setImportedAt(null);
    setSelected(null);
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
              accounts={reviewAccounts.slice(0, 6)}
              followerSet={followerSet}
              onImport={openImporter}
              onReview={setSelected}
              onSeeAll={() => switchView("cleanup")}
              keep={keep}
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
          onClose={() => setSelected(null)}
          onToggleKeep={toggleKeep}
          onToggleReviewed={toggleReviewed}
        />
      ) : null}
    </main>
  );
}
