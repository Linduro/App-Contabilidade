import {
  JURISCONNECT_MUTUAL_REASON_MIN,
  JURISCONNECT_WEIGHTS,
} from "./constants";
import type {
  JurisConnectCandidate,
  JurisConnectScoreBreakdown,
  JurisConnectViewerContext,
} from "./types";

function clamp100(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function logNorm(value: number, scale: number): number {
  if (value <= 0 || scale <= 0) return 0;
  return clamp100((Math.log1p(value) / Math.log1p(scale)) * 100);
}

function normAreas(a: string[]): string[] {
  return a.map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function scoreCommonInterests(
  viewer: JurisConnectViewerContext,
  candidate: JurisConnectCandidate,
  candidateHashtags: string[],
): { score: number; snippet: string | null } {
  const vAreas = normAreas(viewer.practiceAreas);
  const cAreas = normAreas(candidate.practiceAreas);
  let score = 0;
  let matchedArea: string | null = null;

  for (const a of cAreas) {
    if (vAreas.includes(a)) {
      score += 50;
      matchedArea = candidate.practiceAreas.find((x) => x.toLowerCase() === a) ?? a;
      break;
    }
  }

  const cTags = candidateHashtags.map((t) => t.toLowerCase());
  let tagOverlap = 0;
  for (const t of cTags) {
    if (viewer.topHashtags.has(t)) tagOverlap += 1;
  }
  score += Math.min(50, tagOverlap * 12);

  const snippet = matchedArea
    ? `Mesma área: ${matchedArea}`
    : tagOverlap > 0
      ? "Tópicos que você costuma curtir"
      : null;

  return { score: clamp100(score), snippet };
}

function scoreMutualFollowers(count: number): { score: number; snippet: string | null } {
  const score = logNorm(count, 15);
  const snippet =
    count >= JURISCONNECT_MUTUAL_REASON_MIN
      ? `${count} litisconsortes em comum`
      : count === 1
        ? "1 litisconsorte em comum"
        : null;
  return { score, snippet };
}

function scoreProfessionalProximity(
  viewer: JurisConnectViewerContext,
  candidate: JurisConnectCandidate,
): { score: number; snippet: string | null } {
  const vLoc = (viewer.location ?? "").trim().toLowerCase();
  const cLoc = (candidate.location ?? "").trim().toLowerCase();
  if (!vLoc || !cLoc) return { score: 25, snippet: null };

  if (vLoc === cLoc || vLoc.includes(cLoc) || cLoc.includes(vLoc)) {
    const label = candidate.location ?? "sua região";
    return { score: 95, snippet: `Mesma região: ${label}` };
  }
  return { score: 20, snippet: null };
}

function scoreEngagementPotential(
  viewer: JurisConnectViewerContext,
  candidate: JurisConnectCandidate,
): { score: number; snippet: string | null } {
  let score = 30;
  let snippet: string | null = null;

  if (viewer.likedAuthorIds.has(candidate.userId)) {
    score += 55;
    snippet = "Você já curtiu publicações deste perfil";
  }

  if (candidate.oabVerified) score += 10;
  if (candidate.publicationsCount >= 5) score += 5;

  return { score: clamp100(score), snippet };
}

function buildReason(snippets: (string | null)[]): string {
  const parts = snippets.filter((s): s is string => !!s);
  if (parts.length === 0) return "Recomendado para sua rede profissional";
  return parts.slice(0, 2).join(" · ");
}

export function scoreJurisConnectCandidate(
  viewer: JurisConnectViewerContext,
  candidate: JurisConnectCandidate,
  options: {
    mutualCount: number;
    candidateHashtags: string[];
  },
): JurisConnectScoreBreakdown {
  const interests = scoreCommonInterests(viewer, candidate, options.candidateHashtags);
  const mutual = scoreMutualFollowers(options.mutualCount);
  const proximity = scoreProfessionalProximity(viewer, candidate);
  const engagement = scoreEngagementPotential(viewer, candidate);

  const similarityScore =
    interests.score * JURISCONNECT_WEIGHTS.commonInterests +
    mutual.score * JURISCONNECT_WEIGHTS.mutualFollowers +
    proximity.score * JURISCONNECT_WEIGHTS.professionalProximity +
    engagement.score * JURISCONNECT_WEIGHTS.engagementPotential;

  const reason = buildReason([
    interests.snippet,
    mutual.snippet,
    proximity.snippet,
    engagement.snippet,
  ]);

  return {
    commonInterests: Math.round(interests.score * 100) / 100,
    mutualFollowers: Math.round(mutual.score * 100) / 100,
    professionalProximity: Math.round(proximity.score * 100) / 100,
    engagementPotential: Math.round(engagement.score * 100) / 100,
    similarityScore: Math.round(similarityScore * 100) / 100,
    reason,
  };
}
