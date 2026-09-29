"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import {
  buildRelationshipBuckets,
  normalizeUsername,
  summarizeRelationships,
} from "@/features/instagram-data/compare";
import { parseInstagramFiles } from "@/features/instagram-data/parser";
import {
  clearSnapshot,
  loadKeepList,
  loadSnapshot,
  saveKeepList,
  saveSnapshot,
} from "@/features/instagram-data/storage";
import type { InstagramAccount, InstagramRelationshipData } from "@/features/instagram-data/types";

import { BottomNav } from "./bottom-nav";
import type { AppView } from "./bottom-nav";
import { HomeView } from "./home-view";
import { ListView } from "./list-view";
import type { FollowingFilter } from "./list-view";
import { ReviewSheet } from "./review-sheet";
import { SettingsView } from "./settings-view";

const EMPTY: InstagramRelationshipData = { followers: [], following: [] };

const viewTitles: Record<AppView, { eyebrow: string; title: string }> = {
  home: { eyebrow: "IG Cleanup", title: "Your activity" },
  following: { eyebrow: "Connections", title: "Following" },
  cleanup: { eyebrow: "Review queue", title: "Not following back" },
  keep: { eyebrow: "Protected", title: "Keep list" },
  profile: { eyebrow: "Local data", title: "Settings" },
};

export function CleanupApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<AppView>("home");
  const [data, setData] = useState<InstagramRelationshipData | null>(null);
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<InstagramAccount | null>(null);
  const [query, setQuery] = useState("");
  const [followingFilter, setFollowingFilter] = useState<FollowingFilter>("all");
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const snapshot = loadSnapshot();
    if (snapshot) {
      setData(snapshot.data);
      setImportedAt(snapshot.importedAt);
    }
    setKeep(loadKeepList());
  }, []);

  useEffect(() => {
    if (!selected) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

  const safeData = data ?? EMPTY;
  const summary = useMemo(() => summarizeRelationships(safeData), [safeData]);
  const buckets = useMemo(() => buildRelationshipBuckets(safeData), [safeData]);
  const followerSet = useMemo(
    () => new Set(safeData.followers.map((item) => normalizeUsername(item.username))),
    [safeData.followers],
  );

  const reviewAccounts = useMemo(
    () => buckets.notFollowingBack.filter((account) => !keep.has(normalizeUsername(account.username))),
    [buckets.notFollowingBack, keep],
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
    if (view === "cleanup") return reviewAccounts;
    if (view === "keep") return keepAccounts;
    return [];
  }, [filteredFollowing, keepAccounts, reviewAccounts, view]);

  const visibleList = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return baseList;
    return baseList.filter((account) => account.username.toLowerCase().includes(normalizedQuery));
  }, [baseList, query]);

  const switchView = (next: AppView) => {
    setView(next);
    setQuery("");
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setImporting(true);
    setMessage(null);
    try {
      const parsed = await parseInstagramFiles(files);
      const stamp = new Date().toISOString();
      setData(parsed);
      setImportedAt(stamp);
      const saved = saveSnapshot({ data: parsed, importedAt: stamp });
      setMessage(
        saved
          ? "Import complete. Data stays on this device."
          : "Import complete for this session. Browser storage is full or unavailable.",
      );
      setView("home");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read this Instagram export.");
    } finally {
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
  };

  const resetData = () => {
    clearSnapshot();
    setData(null);
    setImportedAt(null);
    setSelected(null);
    setMessage("Imported relationship data was removed from this device.");
    setView("home");
  };

  const openImporter = () => fileInputRef.current?.click();
  const hasData = Boolean(data);
  const title = viewTitles[view];
  const selectedKey = selected ? normalizeUsername(selected.username) : "";
  const selectedKept = selected ? keep.has(selectedKey) : false;
  const selectedFollowsYou = selected ? followerSet.has(selectedKey) : false;

  return (
    <main className="appShell">
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
          <span className="eyebrow">{title.eyebrow}</span>
          <h1>{title.title}</h1>
        </div>
        <button
          className="avatarButton"
          type="button"
          aria-label="Open settings"
          onClick={() => switchView("profile")}
        >
          IG
        </button>
      </header>

      {message ? <div className="notice" role="status">{message}</div> : null}

      {view === "home" ? (
        <HomeView
          hasData={hasData}
          importing={importing}
          summary={summary}
          reviewCount={reviewAccounts.length}
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
          onReview={setSelected}
          onImport={openImporter}
          followingFilter={followingFilter}
          onFollowingFilter={setFollowingFilter}
        />
      ) : null}

      {view === "profile" ? (
        <SettingsView
          hasData={hasData}
          summary={summary}
          importedAt={importedAt}
          keepCount={keep.size}
          importing={importing}
          onImport={openImporter}
          onReset={resetData}
        />
      ) : null}

      <BottomNav active={view} onChange={switchView} />

      {selected ? (
        <ReviewSheet
          account={selected}
          followsYou={selectedFollowsYou}
          kept={selectedKept}
          onClose={() => setSelected(null)}
          onToggleKeep={toggleKeep}
        />
      ) : null}
    </main>
  );
}
