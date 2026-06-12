import {
  CLICKBAIT_PATTERNS,
  EARLY_ENGAGEMENT_WINDOW_MIN,
  JURISRANK_WEIGHTS,
  MIN_SUBSTANTIVE_COMMENT_CHARS,
  OS_FORTES_BOOST,
  RECENCY_HALF_LIFE_DAYS,
  SHORT_REPLY_RATIO_PENALTY_THRESHOLD,
} from "./constants";
import type { PostForScoring, PostScoreResult, ViewerForScoring } from "./types";

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function logNorm(value: number, scale: number): number {
  if (value <= 0 || scale <= 0) return 0;
  return clamp100((Math.log1p(value) / Math.log1p(scale)) * 100);
}

function recencyMultiplier(createdAt: Date, now = new Date()): number {
  const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

function scoreAuthority(post: PostForScoring, osFortes: Set<string>): number {
  let score = 0;

  if (post.author.oabVerified) score += 22;
  score += logNorm(post.author.followersCount, 500) * 0.18;
  score += logNorm(post.author.totalLikesReceived, 2000) * 0.2;

  if (post.sourceIntimationId) score += 18;

  score += post.author.topicConsistency * 15;

  if (post.author.dominantPracticeArea && post.practiceArea) {
    if (
      post.practiceArea.toLowerCase() === post.author.dominantPracticeArea.toLowerCase()
    ) {
      score += 10;
    }
  }

  if (osFortes.has(post.authorId)) score += 8;

  return clamp100(score);
}

function scoreEngagement(post: PostForScoring): number {
  let score =
    logNorm(post.likesCount, 80) * 0.22 +
    logNorm(post.bookmarksCount, 30) * 0.28 +
    logNorm(post.repostsCount, 15) * 0.2 +
    logNorm(post.viewsCount, 500) * 0.15;

  if (post.replies.total > 0) {
    const substantiveRatio = post.replies.substantive / post.replies.total;
    score += substantiveRatio * 25;
    if (substantiveRatio < 1 - SHORT_REPLY_RATIO_PENALTY_THRESHOLD) {
      const shortRatio = post.replies.short / post.replies.total;
      if (shortRatio > SHORT_REPLY_RATIO_PENALTY_THRESHOLD) {
        score *= 0.65;
      }
    }
  }

  if (post.replies.authorReplied) score += 8;
  if (post.replies.earlySubstantive > 0) {
    score += Math.min(12, post.replies.earlySubstantive * 4);
  }

  return clamp100(score);
}

function scoreContentDepth(post: PostForScoring): number {
  let score = 0;
  const len = post.content.trim().length;

  if (len >= 400) score += 35;
  else if (len >= 220) score += 28;
  else if (len >= 120) score += 18;
  else if (len >= 60) score += 8;
  else score += 2;

  if (post.sourceIntimationId) score += 20;
  if (post.mediaCount > 0) score += 12;
  score += logNorm(post.repliesCount, 25) * 0.2;

  for (const pattern of CLICKBAIT_PATTERNS) {
    if (pattern.test(post.content)) {
      score *= 0.5;
      break;
    }
  }

  if (len < 40 && post.repliesCount === 0 && !post.sourceIntimationId) {
    score *= 0.6;
  }

  return clamp100(score);
}

export function scoreRelevance(post: PostForScoring, viewer?: ViewerForScoring): number {
  if (!viewer) return 50;

  let score = 20;

  if (viewer.followingIds.has(post.authorId)) score += 35;

  const postArea = (post.practiceArea ?? "").toLowerCase();
  if (postArea && viewer.practiceAreas.some((a) => a.toLowerCase() === postArea)) {
    score += 25;
  } else if (
    viewer.practiceAreas.some((a) =>
      post.author.practiceAreas.some((ap) => ap.toLowerCase() === a.toLowerCase()),
    )
  ) {
    score += 15;
  }

  const viewerLoc = (viewer.location ?? "").trim().toLowerCase();
  const authorLoc = (post.author.location ?? "").trim().toLowerCase();
  if (viewerLoc && authorLoc && (viewerLoc.includes(authorLoc) || authorLoc.includes(viewerLoc))) {
    score += 12;
  }

  if (viewer.likedAuthorIds.has(post.authorId)) score += 10;

  return clamp100(score);
}

/**
 * Calcula o JurisRank 2026 para uma publicação.
 * `finalScore` inclui recência e boost Os Fortes; relevância do viewer é aplicada no feed.
 */
export function calculatePostScore(
  post: PostForScoring,
  options: {
    osFortes: Set<string>;
    viewer?: ViewerForScoring;
    now?: Date;
  },
): PostScoreResult {
  const { osFortes, viewer, now = new Date() } = options;

  const authorityScore = scoreAuthority(post, osFortes);
  const engagementScore = scoreEngagement(post);
  const contentDepthScore = scoreContentDepth(post);
  const relevanceScore = scoreRelevance(post, viewer);

  const baseScore =
    authorityScore * JURISRANK_WEIGHTS.authority +
    engagementScore * JURISRANK_WEIGHTS.engagement +
    contentDepthScore * JURISRANK_WEIGHTS.contentDepth;

  let finalScore = baseScore * recencyMultiplier(post.createdAt, now);

  if (osFortes.has(post.authorId)) {
    finalScore *= OS_FORTES_BOOST;
  }

  if (viewer) {
    finalScore =
      finalScore * (1 - JURISRANK_WEIGHTS.relevance) +
      relevanceScore * JURISRANK_WEIGHTS.relevance;
  }

  return {
    authorityScore: Math.round(authorityScore * 100) / 100,
    engagementScore: Math.round(engagementScore * 100) / 100,
    contentDepthScore: Math.round(contentDepthScore * 100) / 100,
    relevanceScore: Math.round(relevanceScore * 100) / 100,
    baseScore: Math.round(baseScore * 100) / 100,
    finalScore: Math.round(finalScore * 100) / 100,
  };
}

/** Aplica o pilar de relevância (10%) sobre o score já calculado (com recência/Os Fortes). */
export function applyViewerRelevance(
  storedFinalScore: number,
  post: Pick<PostForScoring, "authorId" | "practiceArea" | "author">,
  viewer: ViewerForScoring,
): number {
  const relevance = scoreRelevance(post as PostForScoring, viewer);
  return (
    Math.round(
      (storedFinalScore * (1 - JURISRANK_WEIGHTS.relevance) +
        relevance * JURISRANK_WEIGHTS.relevance) *
        100,
    ) / 100
  );
}

export { MIN_SUBSTANTIVE_COMMENT_CHARS, EARLY_ENGAGEMENT_WINDOW_MIN };
