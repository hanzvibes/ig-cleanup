import { normalizeUsername } from "./compare";
import type { InstagramRelationshipData, RelationshipDiff } from "./types";

const usernameSet = (accounts: InstagramRelationshipData["followers"]) =>
  new Set(accounts.map((account) => normalizeUsername(account.username)));

const difference = (left: Set<string>, right: Set<string>) =>
  Array.from(left).filter((username) => !right.has(username)).sort();

export function diffRelationships(
  previous: InstagramRelationshipData,
  next: InstagramRelationshipData,
): RelationshipDiff {
  const previousFollowers = usernameSet(previous.followers);
  const nextFollowers = usernameSet(next.followers);
  const previousFollowing = usernameSet(previous.following);
  const nextFollowing = usernameSet(next.following);

  return {
    newFollowers: difference(nextFollowers, previousFollowers),
    lostFollowers: difference(previousFollowers, nextFollowers),
    newFollowing: difference(nextFollowing, previousFollowing),
    removedFollowing: difference(previousFollowing, nextFollowing),
  };
}

export const totalRelationshipChanges = (diff: RelationshipDiff) =>
  diff.newFollowers.length +
  diff.lostFollowers.length +
  diff.newFollowing.length +
  diff.removedFollowing.length;
