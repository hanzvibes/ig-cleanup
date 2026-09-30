export type InstagramAccount = {
  username: string;
  href?: string;
  timestamp?: number;
};

export type InstagramRelationshipData = {
  followers: InstagramAccount[];
  following: InstagramAccount[];
};

export type RelationshipSummary = {
  followers: number;
  following: number;
  mutual: number;
  notFollowingBack: number;
  youDoNotFollowBack: number;
};

export type RelationshipBuckets = {
  mutual: InstagramAccount[];
  notFollowingBack: InstagramAccount[];
  youDoNotFollowBack: InstagramAccount[];
};

export type StoredSnapshot = {
  data: InstagramRelationshipData;
  importedAt: string;
};

export type SortOption = "az" | "za" | "newest" | "oldest";

export type ReviewSession = {
  currentUsername: string;
  position: number;
  total: number;
  sort: SortOption;
  startedAt: string;
};
