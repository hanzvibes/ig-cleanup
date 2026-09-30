import { normalizeUsername } from "@/features/instagram-data/compare";
import type { InstagramAccount, SortOption } from "@/features/instagram-data/types";

import { AccountRow } from "./account-row";
import { BookmarkIcon, CheckIcon, CloseIcon, SearchIcon, UploadIcon } from "./icons";

export type FollowingFilter = "all" | "not-back" | "mutual";
export type CleanupFilter = "pending" | "reviewed";

type ListViewProps = {
  view: "following" | "cleanup" | "keep";
  hasData: boolean;
  query: string;
  onQuery: (value: string) => void;
  accounts: InstagramAccount[];
  total: number;
  followerSet: Set<string>;
  keep: Set<string>;
  reviewed: Set<string>;
  onReview: (account: InstagramAccount) => void;
  onImport: () => void;
  followingFilter: FollowingFilter;
  onFollowingFilter: (filter: FollowingFilter) => void;
  cleanupFilter: CleanupFilter;
  onCleanupFilter: (filter: CleanupFilter) => void;
  sort: SortOption;
  onSort: (sort: SortOption) => void;
  batchMode: boolean;
  selectedKeys: Set<string>;
  onToggleBatchMode: () => void;
  onToggleSelected: (account: InstagramAccount) => void;
  onBatchKeep: () => void;
  onBatchReviewed: () => void;
  onStartSession: () => void;
  sessionProgress: { position: number; total: number } | null;
};

const formatCount = (value: number) => new Intl.NumberFormat().format(value);

const statusFor = (account: InstagramAccount, followerSet: Set<string>) =>
  followerSet.has(normalizeUsername(account.username)) ? "Follows you" : "Not following you";

export function ListView({
  view,
  hasData,
  query,
  onQuery,
  accounts,
  total,
  followerSet,
  keep,
  reviewed,
  onReview,
  onImport,
  followingFilter,
  onFollowingFilter,
  cleanupFilter,
  onCleanupFilter,
  sort,
  onSort,
  batchMode,
  selectedKeys,
  onToggleBatchMode,
  onToggleSelected,
  onBatchKeep,
  onBatchReviewed,
  onStartSession,
  sessionProgress,
}: ListViewProps) {
  if (!hasData) {
    return (
      <section className="compactEmpty">
        <UploadIcon />
        <h2>No Instagram data yet</h2>
        <p>Import your Instagram export to populate this screen.</p>
        <button className="primaryButton" type="button" onClick={onImport}>Import data</button>
      </section>
    );
  }

  const canBatch = view === "cleanup" && cleanupFilter === "pending" && total > 0;

  return (
    <>
      <label className="searchField">
        <SearchIcon aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search"
          autoCapitalize="none"
          autoCorrect="off"
        />
        {query ? (
          <button type="button" onClick={() => onQuery("")} aria-label="Clear search">
            <CloseIcon />
          </button>
        ) : null}
      </label>

      {view === "following" ? (
        <div className="filterTabs" role="tablist" aria-label="Following filters">
          <button className={followingFilter === "all" ? "filterTab filterTabActive" : "filterTab"} type="button" onClick={() => onFollowingFilter("all")}>All</button>
          <button className={followingFilter === "not-back" ? "filterTab filterTabActive" : "filterTab"} type="button" onClick={() => onFollowingFilter("not-back")}>Not back</button>
          <button className={followingFilter === "mutual" ? "filterTab filterTabActive" : "filterTab"} type="button" onClick={() => onFollowingFilter("mutual")}>Mutual</button>
        </div>
      ) : null}

      {view === "cleanup" ? (
        <div className="filterTabs" role="tablist" aria-label="Cleanup filters">
          <button className={cleanupFilter === "pending" ? "filterTab filterTabActive" : "filterTab"} type="button" onClick={() => onCleanupFilter("pending")}>To review</button>
          <button className={cleanupFilter === "reviewed" ? "filterTab filterTabActive" : "filterTab"} type="button" onClick={() => onCleanupFilter("reviewed")}>Reviewed</button>
        </div>
      ) : null}

      {canBatch ? (
        <section className="sessionStrip">
          <div>
            <strong>{sessionProgress ? "Resume review session" : "Review one by one"}</strong>
            <span>
              {sessionProgress
                ? `${sessionProgress.position} / ${sessionProgress.total} saved locally`
                : `${formatCount(total)} accounts ready`}
            </span>
          </div>
          <button type="button" onClick={onStartSession}>
            {sessionProgress ? "Resume" : "Start"}
          </button>
        </section>
      ) : null}

      <div className="listToolbar">
        <div className="listMeta">
          <strong>{formatCount(total)}</strong>
          <span>
            {view === "cleanup"
              ? cleanupFilter === "reviewed" ? "reviewed" : "to review"
              : view === "keep" ? "protected" : "accounts"}
          </span>
        </div>

        <div className="listTools">
          <label className="sortControl">
            <span className="visuallyHidden">Sort accounts</span>
            <select
              aria-label="Sort accounts"
              value={sort}
              onChange={(event) => onSort(event.target.value as SortOption)}
            >
              <option value="az">A–Z</option>
              <option value="za">Z–A</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>

          {canBatch ? (
            <button className={batchMode ? "textTool textToolActive" : "textTool"} type="button" onClick={onToggleBatchMode}>
              {batchMode ? "Done" : "Select"}
            </button>
          ) : null}
        </div>
      </div>

      <section className="accountList">
        {accounts.length ? accounts.map((account) => {
          const key = normalizeUsername(account.username);
          return (
            <AccountRow
              key={account.username}
              account={account}
              status={statusFor(account, followerSet)}
              kept={keep.has(key)}
              reviewed={reviewed.has(key)}
              selectionMode={batchMode && canBatch}
              selected={selectedKeys.has(key)}
              onReview={onReview}
              onToggleSelected={onToggleSelected}
            />
          );
        }) : (
          <div className="listEmpty">
            <strong>No accounts found</strong>
            <span>
              {query
                ? "Try another username."
                : view === "keep"
                  ? "Add accounts to Keep from any review sheet."
                  : view === "cleanup" && cleanupFilter === "reviewed"
                    ? "Accounts you mark Reviewed will appear here."
                    : "There is nothing in this list yet."}
            </span>
          </div>
        )}
      </section>

      {batchMode && canBatch ? (
        <div className="batchBar" role="toolbar" aria-label="Batch actions">
          <span>{selectedKeys.size} selected</span>
          <button type="button" onClick={onBatchKeep} disabled={selectedKeys.size === 0}>
            <BookmarkIcon aria-hidden="true" /> Keep
          </button>
          <button type="button" onClick={onBatchReviewed} disabled={selectedKeys.size === 0}>
            <CheckIcon aria-hidden="true" /> Reviewed
          </button>
        </div>
      ) : null}
    </>
  );
}
