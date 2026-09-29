import type {
  InstagramAccount,
  InstagramRelationshipData,
  RelationshipBuckets,
  RelationshipSummary,
} from "./types";

export const normalizeUsername = (value: string) =>
  value.trim().replace(/^@/, "").toLowerCase();

const uniqueByUsername = (accounts: InstagramAccount[]) => {
  const seen = new Set<string>();
  return accounts.filter((account) => {
    const key = normalizeUsername(account.username);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function normalizeRelationshipData(
  data: InstagramRelationshipData,
): InstagramRelationshipData {
  return {
    followers: uniqueByUsername(data.followers),
    following: uniqueByUsername(data.following),
  };
}

export function buildRelationshipBuckets(
  input: InstagramRelationshipData,
): RelationshipBuckets {
  const data = normalizeRelationshipData(input);
  const followerSet = new Set(
    data.followers.map((item) => normalizeUsername(item.username)),
  );
  const followingSet = new Set(
    data.following.map((item) => normalizeUsername(item.username)),
  );

  return {
    mutual: data.following.filter((item) =>
      followerSet.has(normalizeUsername(item.username)),
    ),
    notFollowingBack: data.following.filter(
      (item) => !followerSet.has(normalizeUsername(item.username)),
    ),
    youDoNotFollowBack: data.followers.filter(
      (item) => !followingSet.has(normalizeUsername(item.username)),
    ),
  };
}

export function summarizeRelationships(
  input: InstagramRelationshipData,
): RelationshipSummary {
  const data = normalizeRelationshipData(input);
  const buckets = buildRelationshipBuckets(data);

  return {
    followers: data.followers.length,
    following: data.following.length,
    mutual: buckets.mutual.length,
    notFollowingBack: buckets.notFollowingBack.length,
    youDoNotFollowBack: buckets.youDoNotFollowBack.length,
  };
}
