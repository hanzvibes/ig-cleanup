import { normalizeUsername } from "@/features/instagram-data/compare";
import type { InstagramAccount, RelationshipSummary } from "@/features/instagram-data/types";

import { AccountRow } from "./account-row";
import { UploadIcon } from "./icons";

type HomeViewProps = {
  hasData: boolean;
  importing: boolean;
  summary: RelationshipSummary;
  reviewCount: number;
  accounts: InstagramAccount[];
  followerSet: Set<string>;
  onImport: () => void;
  onReview: (account: InstagramAccount) => void;
  onSeeAll: () => void;
  keep: Set<string>;
};

const formatCount = (value: number) => new Intl.NumberFormat().format(value);

const statusFor = (account: InstagramAccount, followerSet: Set<string>) =>
  followerSet.has(normalizeUsername(account.username)) ? "Follows you" : "Not following you";

export function HomeView({
  hasData,
  importing,
  summary,
  reviewCount,
  accounts,
  followerSet,
  onImport,
  onReview,
  onSeeAll,
  keep,
}: HomeViewProps) {
  if (!hasData) {
    return (
      <section className="emptyState">
        <div className="emptyGlyph"><UploadIcon /></div>
        <h2>Start with your Instagram export</h2>
        <p>Import the ZIP from Instagram. Followers and following are compared locally in your browser.</p>
        <button className="primaryButton" type="button" onClick={onImport} disabled={importing}>
          {importing ? "Reading export…" : "Import Instagram data"}
        </button>
        <div className="privacyStrip">
          <span>Private by default</span>
          <span>•</span>
          <span>No password needed</span>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="profileSummary">
        <div className="profileAvatar">IG</div>
        <div className="profileStats">
          <div><strong>{formatCount(summary.following)}</strong><span>following</span></div>
          <div><strong>{formatCount(summary.followers)}</strong><span>followers</span></div>
          <div><strong>{formatCount(summary.mutual)}</strong><span>mutual</span></div>
        </div>
      </section>

      <button className="importRow" type="button" onClick={onImport}>
        <span className="importRowIcon"><UploadIcon /></span>
        <span>
          <strong>Update Instagram data</strong>
          <small>Re-import anytime for a fresh comparison</small>
        </span>
        <span className="importRowMeta">Local</span>
      </button>

      <section className="metricCard">
        <span className="metricLabel">Review queue</span>
        <strong>{formatCount(reviewCount)}</strong>
        <p>accounts you follow that do not appear in your followers export and are not protected in Keep.</p>
        <button type="button" onClick={onSeeAll}>Review accounts</button>
      </section>

      <section className="sectionHeader">
        <div>
          <h2>Suggested to review</h2>
          <p>Keep important accounts out of your cleanup queue.</p>
        </div>
        <button type="button" onClick={onSeeAll}>See all</button>
      </section>

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
            <strong>Queue cleared</strong>
            <span>Everything here is either mutual or protected in Keep.</span>
          </div>
        )}
      </section>
    </>
  );
}
