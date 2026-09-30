import { normalizeUsername } from "@/features/instagram-data/compare";
import type {
  ImportHistoryEntry,
  InstagramAccount,
  RelationshipSummary,
  SessionSummary,
} from "@/features/instagram-data/types";

import { AccountRow } from "./account-row";
import { UploadIcon } from "./icons";

type HomeViewProps = {
  hasData: boolean;
  importing: boolean;
  summary: RelationshipSummary;
  reviewCount: number;
  reviewedCount: number;
  accounts: InstagramAccount[];
  followerSet: Set<string>;
  onImport: () => void;
  onReview: (account: InstagramAccount) => void;
  onSeeAll: () => void;
  keep: Set<string>;
  sessionProgress: { position: number; total: number } | null;
  onStartSession: () => void;
  lastImport: ImportHistoryEntry | null;
  lastSessionSummary: SessionSummary | null;
};

const formatCount = (value: number) => new Intl.NumberFormat().format(value);

const statusFor = (account: InstagramAccount, followerSet: Set<string>) =>
  followerSet.has(normalizeUsername(account.username)) ? "Follows you" : "Not following you";

export function HomeView({
  hasData,
  importing,
  summary,
  reviewCount,
  reviewedCount,
  accounts,
  followerSet,
  onImport,
  onReview,
  onSeeAll,
  keep,
  sessionProgress,
  onStartSession,
  lastImport,
  lastSessionSummary,
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
        <div className="privacyStrip"><span>Private by default</span><span>•</span><span>No password needed</span></div>
      </section>
    );
  }

  const changeTotal = lastImport
    ? Object.values(lastImport.changes).reduce((sum, value) => sum + value, 0)
    : 0;

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
        <span><strong>Update Instagram data</strong><small>Smart compare before replacing your local snapshot</small></span>
        <span className="importRowMeta">Local</span>
      </button>

      {lastImport?.previousImportedAt ? (
        <section className="changeCard" data-testid="last-import-changes">
          <div><strong>{changeTotal}</strong><span>changes since last import</span></div>
          <div className="changeChips">
            <span>+{lastImport.changes.newFollowers} followers</span>
            <span>-{lastImport.changes.lostFollowers} followers</span>
            <span>+{lastImport.changes.newFollowing} following</span>
            <span>-{lastImport.changes.removedFollowing} following</span>
          </div>
        </section>
      ) : null}

      <section className="cleanupPanel">
        <div className="cleanupPanelHead">
          <div><strong>Cleanup</strong><span>Accounts that do not follow you back</span></div>
          <button type="button" onClick={onSeeAll}>Open</button>
        </div>
        <div className="cleanupStats">
          <div><strong data-testid="pending-count">{formatCount(reviewCount)}</strong><span>To review</span></div>
          <div><strong data-testid="reviewed-count">{formatCount(reviewedCount)}</strong><span>Reviewed</span></div>
        </div>

        {reviewCount > 0 ? (
          <button className="sessionHomeButton" type="button" onClick={onStartSession}>
            <span>
              <strong>{sessionProgress ? "Resume review session" : "Start review session"}</strong>
              <small>{sessionProgress ? `Continue ${sessionProgress.position} / ${sessionProgress.total}` : `Review ${formatCount(reviewCount)} accounts one by one`}</small>
            </span>
            <b>{sessionProgress ? "Resume" : "Start"}</b>
          </button>
        ) : null}
      </section>

      {lastSessionSummary ? (
        <section className="sessionSummaryCard" data-testid="last-session-summary">
          <strong>Last review session</strong>
          <span>{lastSessionSummary.reviewed} reviewed · {lastSessionSummary.kept} kept · {lastSessionSummary.skipped} skipped</span>
        </section>
      ) : null}

      <section className="sectionHeader">
        <div><h2>Suggested to review</h2><p>Keep important accounts out of your cleanup queue.</p></div>
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
          <div className="listEmpty"><strong>Queue cleared</strong><span>Everything here is mutual, protected in Keep, or already reviewed.</span></div>
        )}
      </section>
    </>
  );
}
