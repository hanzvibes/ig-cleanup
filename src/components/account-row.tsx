import type { InstagramAccount } from "@/features/instagram-data/types";

import { CheckIcon, MoreIcon } from "./icons";

type AccountRowProps = {
  account: InstagramAccount;
  status: string;
  kept?: boolean;
  reviewed?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onReview: (account: InstagramAccount) => void;
  onToggleSelected?: (account: InstagramAccount) => void;
};

const initialsFor = (username: string) => username.slice(0, 2).toUpperCase();

export function AccountRow({
  account,
  status,
  kept = false,
  reviewed = false,
  selectionMode = false,
  selected = false,
  onReview,
  onToggleSelected,
}: AccountRowProps) {
  const detail = [reviewed ? "Reviewed" : "", kept ? "Keep" : "", status]
    .filter(Boolean)
    .join(" · ");

  const activate = () => {
    if (selectionMode) onToggleSelected?.(account);
    else onReview(account);
  };

  return (
    <article className={selected ? "accountRow accountRowSelected" : "accountRow"}>
      {selectionMode ? (
        <button
          className={selected ? "selectCircle selectCircleActive" : "selectCircle"}
          type="button"
          aria-label={(selected ? "Deselect " : "Select ") + account.username}
          aria-pressed={selected}
          onClick={activate}
        >
          {selected ? <CheckIcon aria-hidden="true" /> : null}
        </button>
      ) : (
        <div className="avatar" aria-hidden="true">{initialsFor(account.username)}</div>
      )}

      <button className="accountMain" type="button" onClick={activate}>
        <strong>{account.username}</strong>
        <span>{detail}</span>
      </button>

      {selectionMode ? null : (
        <button
          className="rowAction"
          type="button"
          onClick={() => onReview(account)}
          aria-label={"Review " + account.username}
        >
          <span>Review</span>
          <MoreIcon aria-hidden="true" />
        </button>
      )}
    </article>
  );
}
