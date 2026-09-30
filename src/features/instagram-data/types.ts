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
  history?: string[];
  skipped?: string[];
  reviewedCount?: number;
  keptCount?: number;
};

export type SessionSummary = {
  finishedAt: string;
  total: number;
  reviewed: number;
  kept: number;
  skipped: number;
};

export type ImportDiagnostics = {
  filesScanned: number;
  relationshipFiles: number;
  duplicatesIgnored: number;
  invalidEntriesIgnored: number;
  malformedFiles: string[];
};

export type RelationshipDiff = {
  newFollowers: string[];
  lostFollowers: string[];
  newFollowing: string[];
  removedFollowing: string[];
};

export type ImportHistoryEntry = {
  id: string;
  importedAt: string;
  previousImportedAt?: string;
  followers: number;
  following: number;
  changes: {
    newFollowers: number;
    lostFollowers: number;
    newFollowing: number;
    removedFollowing: number;
  };
  diagnostics: ImportDiagnostics;
};

export type AppBackupV1 = {
  version: 1;
  exportedAt: string;
  snapshot: StoredSnapshot | null;
  keep: string[];
  reviewed: string[];
  importHistory: ImportHistoryEntry[];
  reviewSession: ReviewSession | null;
  lastSessionSummary: SessionSummary | null;
};
