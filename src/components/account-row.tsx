import type { InstagramAccount } from "@/features/instagram-data/types";

import { MoreIcon } from "./icons";

type AccountRowProps = {
  account: InstagramAccount;
  status: string;
  kept?: boolean;
  onReview: (account: InstagramAccount) => void;
};

const initialsFor = (username: string) => username.slice(0, 2).toUpperCase();

export function AccountRow({ account, status, kept = false, onReview }: AccountRowProps) {
  return (
    <article className="accountRow">
      <div className="avatar" aria-hidden="true">{initialsFor(account.username)}</div>
      <button className="accountMain" type="button" onClick={() => onReview(account)}>
        <strong>{account.username}</strong>
        <span>{status}{kept ? " · Keep" : ""}</span>
      </button>
      <button
        className="rowAction"
        type="button"
        onClick={() => onReview(account)}
        aria-label={"Review " + account.username}
      >
        <span>Review</span>
        <MoreIcon aria-hidden="true" />
      </button>
    </article>
  );
}
