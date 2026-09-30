import type { PointerEvent as ReactPointerEvent } from "react";
import type { DetailedImportResult } from "@/features/instagram-data/parser";
import type { RelationshipDiff } from "@/features/instagram-data/types";

import { CloseIcon } from "./icons";

type ImportPreviewSheetProps = {
  result: DetailedImportResult;
  diff: RelationshipDiff;
  previousImportedAt: string | null;
  onApply: () => void;
  onCancel: () => void;
};

export function ImportPreviewSheet({
  result,
  diff,
  previousImportedAt,
  onApply,
  onCancel,
}: ImportPreviewSheetProps) {
  const { diagnostics, data } = result;
  const totalChanges =
    diff.newFollowers.length + diff.lostFollowers.length +
    diff.newFollowing.length + diff.removedFollowing.length;

  return (
    <div className="sheetBackdrop" role="presentation" onPointerDown={onCancel}>
      <section
        className="reviewSheet importPreviewSheet"
        role="dialog"
        aria-modal="true"
        aria-label="Import changes"
        onPointerDown={(event: ReactPointerEvent<HTMLElement>) => event.stopPropagation()}
      >
        <div className="sheetHandle" />
        <button className="sheetClose" type="button" onClick={onCancel} aria-label="Close">
          <CloseIcon />
        </button>
        <div className="previewEyebrow">Smart re-import</div>
        <h2>{totalChanges} relationship changes</h2>
        <p className="sheetStatus">
          {previousImportedAt ? `Compared with ${new Date(previousImportedAt).toLocaleString()}` : "Fresh import"}
        </p>

        <div className="previewGrid">
          <div><strong>+{diff.newFollowers.length}</strong><span>new followers</span></div>
          <div><strong>-{diff.lostFollowers.length}</strong><span>lost followers</span></div>
          <div><strong>+{diff.newFollowing.length}</strong><span>new following</span></div>
          <div><strong>-{diff.removedFollowing.length}</strong><span>removed following</span></div>
        </div>

        <div className="previewTotals">
          <span>{data.followers.length} followers</span>
          <span>{data.following.length} following</span>
        </div>

        <div className="diagnosticLine">
          <span>{diagnostics.relationshipFiles} relationship files</span>
          <span>{diagnostics.duplicatesIgnored} duplicates ignored</span>
          <span>{diagnostics.invalidEntriesIgnored} invalid ignored</span>
          {diagnostics.malformedFiles.length ? <span>{diagnostics.malformedFiles.length} malformed skipped</span> : null}
        </div>

        <button className="primaryAction" type="button" onClick={onApply}>Apply update</button>
        <button className="secondaryAction" type="button" onClick={onCancel}>Cancel</button>
      </section>
    </div>
  );
}
