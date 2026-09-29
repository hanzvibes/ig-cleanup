import type { InstagramRelationshipData, RelationshipSummary } from "./types";

const normalize = (value: string) => value.trim().replace(/^@/, "").toLowerCase();

export function summarizeRelationships(data: InstagramRelationshipData): RelationshipSummary {
  const followerSet = new Set(data.followers.map((item) => normalize(item.username)));
  const followingSet = new Set(data.following.map((item) => normalize(item.username)));

  let mutual = 0;
  for (const username of followingSet) {
    if (followerSet.has(username)) mutual += 1;
  }

  return {
    followers: followerSet.size,
    following: followingSet.size,
    mutual,
    notFollowingBack: followingSet.size - mutual,
    youDoNotFollowBack: followerSet.size - mutual,
  };
}
