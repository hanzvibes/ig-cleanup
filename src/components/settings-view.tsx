import type { RelationshipSummary } from "@/features/instagram-data/types";

import { CheckIcon, TrashIcon, UploadIcon } from "./icons";

type SettingsViewProps = {
  hasData: boolean;
  summary: RelationshipSummary;
  importedAt: string | null;
  keepCount: number;
  reviewedCount: number;
  importHistoryCount: number;
  importing: boolean;
  storageUsage: string;
  onImport: () => void;
  onExportBackup: () => void;
  onRestoreBackup: () => void;
  onDeleteData: () => void;
  onClearKeep: () => void;
  onClearReviewed: () => void;
  onResetAll: () => void;
};

const formatCount = (value: number) => new Intl.NumberFormat().format(value);

export function SettingsView({
  hasData,
  summary,
  importedAt,
  keepCount,
  reviewedCount,
  importHistoryCount,
  importing,
  storageUsage,
  onImport,
  onExportBackup,
  onRestoreBackup,
  onDeleteData,
  onClearKeep,
  onClearReviewed,
  onResetAll,
}: SettingsViewProps) {
  let importDescription = "ZIP, JSON, or HTML export";
  if (importing) importDescription = "Reading export…";
  else if (hasData && importedAt) importDescription = "Last import " + new Date(importedAt).toLocaleString();

  return (
    <section className="settingsList">
      <div className="settingsHero">
        <div className="settingsAvatar">IG</div>
        <div><strong>IG Cleanup</strong><span>Independent local-first utility</span></div>
      </div>

      <div className="settingsGroup">
        <span className="settingsLabel">Instagram data</span>
        <button type="button" onClick={onImport}>
          <span><strong>{hasData ? "Smart re-import" : "Import data"}</strong><small>{importDescription}</small></span>
          <UploadIcon />
        </button>
        <div className="settingsStat"><span>Following</span><strong>{formatCount(summary.following)}</strong></div>
        <div className="settingsStat"><span>Followers</span><strong>{formatCount(summary.followers)}</strong></div>
        <div className="settingsStat"><span>Import history</span><strong>{formatCount(importHistoryCount)}</strong></div>
        <div className="settingsStat"><span>Local storage used</span><strong>{storageUsage}</strong></div>
      </div>

      <div className="settingsGroup">
        <span className="settingsLabel">Backup & restore</span>
        <button type="button" onClick={onExportBackup}>
          <span><strong>Export app backup</strong><small>Snapshot, Keep, Reviewed, history, and session state</small></span>
          <CheckIcon />
        </button>
        <button type="button" onClick={onRestoreBackup}>
          <span><strong>Restore app backup</strong><small>Restore a versioned IG Cleanup JSON backup</small></span>
          <UploadIcon />
        </button>
      </div>

      <div className="settingsGroup">
        <span className="settingsLabel">Cleanup progress</span>
        <div className="settingsStat"><span>Keep list</span><strong>{formatCount(keepCount)}</strong></div>
        <div className="settingsStat"><span>Reviewed</span><strong>{formatCount(reviewedCount)}</strong></div>
        {keepCount > 0 ? (
          <button type="button" onClick={onClearKeep}>
            <span><strong>Clear Keep list</strong><small>Return protected accounts to normal review logic</small></span>
            <TrashIcon />
          </button>
        ) : null}
        {reviewedCount > 0 ? (
          <button type="button" onClick={onClearReviewed}>
            <span><strong>Reset reviewed history</strong><small>Return reviewed accounts to the queue</small></span>
            <CheckIcon />
          </button>
        ) : null}
      </div>

      <div className="settingsGroup">
        <span className="settingsLabel">Privacy</span>
        <div className="settingsCopy">
          <strong>Processed on this device</strong>
          <p>Your Instagram export is parsed locally. Relationship data is not sent to an IG Cleanup app server.</p>
        </div>
        <details className="privacyDetails">
          <summary>What stays local?</summary>
          <p>Imported relationship snapshots, Keep, Reviewed, review-session progress, and import history stay in browser storage. Backups are only created when you explicitly export one.</p>
        </details>
      </div>

      {hasData ? (
        <button className="dangerButton" type="button" onClick={onDeleteData}>
          <TrashIcon /> Delete imported relationship data
        </button>
      ) : null}
      <button className="dangerButton dangerButtonStrong" type="button" onClick={onResetAll}>
        <TrashIcon /> Reset everything on this device
      </button>

      <p className="disclaimer">IG Cleanup is not affiliated with, endorsed by, or sponsored by Instagram or Meta.</p>
    </section>
  );
}
