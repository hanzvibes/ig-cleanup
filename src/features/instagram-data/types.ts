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
