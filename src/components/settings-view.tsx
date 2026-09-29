import type { RelationshipSummary } from "@/features/instagram-data/types";

import { CheckIcon, TrashIcon, UploadIcon } from "./icons";

type SettingsViewProps = {
  hasData: boolean;
  summary: RelationshipSummary;
  importedAt: string | null;
  keepCount: number;
  reviewedCount: number;
  importing: boolean;
  onImport: () => void;
  onReset: () => void;
  onClearReviewed: () => void;
};

const formatCount = (value: number) => new Intl.NumberFormat().format(value);

export function SettingsView({
  hasData,
  summary,
  importedAt,
  keepCount,
  reviewedCount,
  importing,
  onImport,
  onReset,
  onClearReviewed,
}: SettingsViewProps) {
  let importDescription = "ZIP, JSON, or HTML export";
  if (importing) importDescription = "Reading export…";
  else if (hasData && importedAt) importDescription = "Last import " + new Date(importedAt).toLocaleString();

  return (
    <section className="settingsList">
      <div className="settingsHero">
        <div className="settingsAvatar">IG</div>
        <div>
          <strong>IG Cleanup</strong>
          <span>Independent local-first utility</span>
        </div>
      </div>

      <div className="settingsGroup">
        <span className="settingsLabel">Instagram data</span>
        <button type="button" onClick={onImport}>
          <span>
            <strong>{hasData ? "Re-import data" : "Import data"}</strong>
            <small>{importDescription}</small>
          </span>
          <UploadIcon />
        </button>
        <div className="settingsStat"><span>Following</span><strong>{formatCount(summary.following)}</strong></div>
        <div className="settingsStat"><span>Followers</span><strong>{formatCount(summary.followers)}</strong></div>
        <div className="settingsStat"><span>Keep list</span><strong>{formatCount(keepCount)}</strong></div>
        <div className="settingsStat"><span>Reviewed</span><strong>{formatCount(reviewedCount)}</strong></div>
      </div>

      {reviewedCount > 0 ? (
        <div className="settingsGroup">
          <span className="settingsLabel">Cleanup progress</span>
          <button type="button" onClick={onClearReviewed}>
            <span>
              <strong>Reset reviewed history</strong>
              <small>Return reviewed accounts to the queue</small>
            </span>
            <CheckIcon />
          </button>
        </div>
      ) : null}

      <div className="settingsGroup">
        <span className="settingsLabel">Privacy</span>
        <div className="settingsCopy">
          <strong>Processed on this device</strong>
          <p>Your export is parsed locally. Relationship data is not uploaded to an app server.</p>
        </div>
      </div>

      {hasData ? (
        <button className="dangerButton" type="button" onClick={onReset}>
          <TrashIcon /> Delete imported local data
        </button>
      ) : null}

      <p className="disclaimer">IG Cleanup is not affiliated with, endorsed by, or sponsored by Instagram or Meta.</p>
    </section>
  );
}
