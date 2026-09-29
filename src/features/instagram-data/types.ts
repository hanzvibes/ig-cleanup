export type InstagramAccount = {
  username: string;
  href?: string;
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
