/** Publicação + sinais agregados para o JurisRank. */
export type PostForScoring = {
  id: string;
  authorId: string;
  content: string;
  practiceArea: string | null;
  createdAt: Date;
  likesCount: number;
  bookmarksCount: number;
  repostsCount: number;
  viewsCount: number;
  repliesCount: number;
  sourceIntimationId: string | null;
  mediaCount: number;
  author: {
    practiceAreas: string[];
    location: string | null;
    oabVerified: boolean;
    followersCount: number;
    publicationsCount: number;
    totalLikesReceived: number;
    dominantPracticeArea: string | null;
    topicConsistency: number;
  };
  replies: {
    total: number;
    substantive: number;
    short: number;
    authorReplied: boolean;
    earlySubstantive: number;
    /** JurisFeed: comentários substantivos nas primeiras 2h */
    earlySubstantive2h: number;
  };
  reportCount?: number;
};

/** Visualizador do feed (relevância personalizada). */
export type ViewerForScoring = {
  userId: string;
  practiceAreas: string[];
  location: string | null;
  followingIds: Set<string>;
  likedAuthorIds: Set<string>;
};

export type PostScoreResult = {
  authorityScore: number;
  engagementScore: number;
  contentDepthScore: number;
  relevanceScore: number;
  baseScore: number;
  finalScore: number;
};

export type JurisRankCursor = {
  finalScore: number;
  createdAt: Date;
  id: string;
};
