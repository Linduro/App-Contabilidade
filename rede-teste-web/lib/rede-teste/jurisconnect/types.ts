export type JurisConnectViewerContext = {
  userId: string;
  practiceAreas: string[];
  location: string | null;
  followingIds: Set<string>;
  blockedIds: Set<string>;
  likedAuthorIds: Set<string>;
  topHashtags: Set<string>;
};

export type JurisConnectCandidate = {
  userId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  image: string | null;
  oabVerified: boolean;
  verificationType: string;
  practiceAreas: string[];
  location: string | null;
  followersCount: number;
  publicationsCount: number;
};

export type JurisConnectRecommendation = {
  userId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  image: string | null;
  oabVerified: boolean;
  verificationType: string;
  similarityScore: number;
  reason: string;
  following: boolean;
};

export type JurisConnectScoreBreakdown = {
  commonInterests: number;
  mutualFollowers: number;
  professionalProximity: number;
  engagementPotential: number;
  similarityScore: number;
  reason: string;
};
