import { normalizeUsername } from "@/features/instagram-data/compare";
import type { InstagramAccount } from "@/features/instagram-data/types";

import { AccountRow } from "./account-row";
import { CloseIcon, SearchIcon, UploadIcon } from "./icons";

export type FollowingFilter = "all" | "not-back" | "mutual";

type ListViewProps = {
  view: "following" | "cleanup" | "keep";
  hasData: boolean;
  query: string;
  onQuery: (value: string) => void;
  accounts: InstagramAccount[];
  total: number;
  followerSet: Set<string>;
  keep: Set<string>;
  onReview: (account: InstagramAccount) => void;
  onImport: () => void;
  followingFilter: FollowingFilter;
  onFollowingFilter: (filter: FollowingFilter) => void;
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
  onReview,
  onImport,
  followingFilter,
  onFollowingFilter,
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
          <button
            className={followingFilter === "all" ? "filterTab filterTabActive" : "filterTab"}
            type="button"
            onClick={() => onFollowingFilter("all")}
          >
            All
          </button>
          <button
            className={followingFilter === "not-back" ? "filterTab filterTabActive" : "filterTab"}
            type="button"
            onClick={() => onFollowingFilter("not-back")}
          >
            Not back
          </button>
          <button
            className={followingFilter === "mutual" ? "filterTab filterTabActive" : "filterTab"}
            type="button"
            onClick={() => onFollowingFilter("mutual")}
          >
            Mutual
          </button>
        </div>
      ) : null}

      <div className="listMeta">
        <strong>{formatCount(total)}</strong>
        <span>{view === "cleanup" ? "to review" : view === "keep" ? "protected" : "accounts"}</span>
      </div>

      <section className="accountList">
        {accounts.length ? accounts.map((account) => (
          <AccountRow
            key={account.username}
            account={account}
            status={statusFor(account, followerSet)}
            kept={keep.has(normalizeUsername(account.username))}
            onReview={onReview}
          />
        )) : (
          <div className="listEmpty">
            <strong>No accounts found</strong>
            <span>
              {query
                ? "Try another username."
                : view === "keep"
                  ? "Add accounts to Keep from any review sheet."
                  : "There is nothing in this list yet."}
            </span>
          </div>
        )}
      </section>
    </>
  );
}
