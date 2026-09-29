import type { InstagramAccount } from "@/features/instagram-data/types";

import { BookmarkIcon, CheckIcon, CloseIcon, ExternalIcon } from "./icons";

type ReviewSheetProps = {
  account: InstagramAccount;
  followsYou: boolean;
  kept: boolean;
  reviewed: boolean;
  onClose: () => void;
  onToggleKeep: (username: string) => void;
  onToggleReviewed: (username: string) => void;
};

export function ReviewSheet({
  account,
  followsYou,
  kept,
  reviewed,
  onClose,
  onToggleKeep,
  onToggleReviewed,
}: ReviewSheetProps) {
  const profileUrl = "https://www.instagram.com/" + encodeURIComponent(account.username) + "/";

  return (
    <div className="sheetBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="reviewSheet"
        role="dialog"
        aria-modal="true"
        aria-label={"Review " + account.username}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheetHandle" />
        <button className="sheetClose" type="button" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>

        <div className="sheetAvatar" aria-hidden="true">{account.username.slice(0, 2).toUpperCase()}</div>
        <h2>@{account.username}</h2>
        <p className="sheetStatus">
          {followsYou ? "Follows you" : "Does not follow you back"}
          {reviewed ? " · Reviewed" : kept ? " · In Keep list" : ""}
        </p>

        <a className="primaryAction" href={profileUrl} target="_blank" rel="noreferrer">
          Open in Instagram <ExternalIcon aria-hidden="true" />
        </a>
        <button className="secondaryAction" type="button" onClick={() => onToggleReviewed(account.username)}>
          <CheckIcon aria-hidden="true" /> {reviewed ? "Move back to review queue" : "Mark as reviewed"}
        </button>
        <button className="secondaryAction" type="button" onClick={() => onToggleKeep(account.username)}>
          <BookmarkIcon aria-hidden="true" /> {kept ? "Remove from Keep list" : "Add to Keep list"}
        </button>

        <p className="sheetNote">
          Unfollow decisions stay in Instagram. Mark Reviewed after you finish checking the account.
        </p>
      </section>
    </div>
  );
}
