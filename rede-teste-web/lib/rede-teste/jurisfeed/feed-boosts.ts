import type { PostForScoring } from "@/lib/rede-teste/jurisrank/types";
import {
  JURISFEED_FRESH_BOOST_HOURS,
  JURISFEED_FRESH_BOOST_MAX,
  JURISFEED_MAX_COMBINED_BOOST,
  JURISFEED_REPORT_PENALTY_MAX,
  JURISFEED_REPORT_PENALTY_PER,
  JURISFEED_SPIKE_MAX_AGE_MIN,
  JURISFEED_SPIKE_MIN_ACTIONS,
  JURISFEED_STALE_HOURS,
  JURISFEED_STALE_MULTIPLIER,
  JURISFEED_VELOCITY_WINDOW_MIN,
} from "./constants";

function logNorm(value: number, scale: number): number {
  if (value <= 0 || scale <= 0) return 0;
  return Math.min(1, Math.log1p(value) / Math.log1p(scale));
}

/** Velocidade nas primeiras 2h (likes + reposts + comentários substantivos). */
export function jurisFeedVelocityMultiplier(post: PostForScoring, now = new Date()): number {
  const ageMin = (now.getTime() - post.createdAt.getTime()) / 60_000;
  const windowMin = JURISFEED_VELOCITY_WINDOW_MIN;

  let earlyActions: number;
  if (ageMin <= windowMin) {
    earlyActions =
      post.likesCount + post.repostsCount + post.replies.earlySubstantive2h;
  } else {
    earlyActions =
      post.replies.earlySubstantive2h * 2 +
      Math.min(post.likesCount, 15) +
      Math.min(post.repostsCount, 8);
  }

  const velocity = logNorm(earlyActions, 35);
  return 1 + velocity * 0.12;
}

/** Recência estilo Twitter: boost <6h, queda após 48h. */
export function jurisFeedRecencyMultiplier(post: PostForScoring, now = new Date()): number {
  const ageHours = (now.getTime() - post.createdAt.getTime()) / 3_600_000;

  if (ageHours <= JURISFEED_FRESH_BOOST_HOURS) {
    const t = 1 - ageHours / JURISFEED_FRESH_BOOST_HOURS;
    return 1 + t * (JURISFEED_FRESH_BOOST_MAX - 1);
  }
  if (ageHours >= JURISFEED_STALE_HOURS) {
    return JURISFEED_STALE_MULTIPLIER;
  }
  return 1;
}

/** Penalidade por denúncias de spam. */
export function jurisFeedSpamMultiplier(reportCount: number): number {
  if (reportCount <= 0) return 1;
  const penalty = Math.min(
    JURISFEED_REPORT_PENALTY_MAX,
    reportCount * JURISFEED_REPORT_PENALTY_PER,
  );
  return 1 - penalty;
}

/** Pico artificial: muito engajamento cedo com comentários quase todos curtos. */
export function jurisFeedSuspiciousEngagementMultiplier(
  post: PostForScoring,
  now = new Date(),
): number {
  const ageMin = (now.getTime() - post.createdAt.getTime()) / 60_000;
  if (ageMin > JURISFEED_SPIKE_MAX_AGE_MIN) return 1;

  const totalActions = post.likesCount + post.repostsCount + post.replies.total;
  if (totalActions < JURISFEED_SPIKE_MIN_ACTIONS) return 1;

  if (post.replies.total === 0) return 1;
  const shortRatio = post.replies.short / post.replies.total;
  if (shortRatio > 0.85 && post.replies.substantive < 3) {
    return 0.75;
  }
  return 1;
}

/**
 * Multiplicadores JurisFeed sobre o score JurisRank já calculado.
 * Não altera a fórmula base do JurisRank 2026.
 */
export function applyJurisFeedBoosts(
  jurisRankScore: number,
  post: PostForScoring,
  options?: { reportCount?: number; now?: Date },
): number {
  const now = options?.now ?? new Date();
  const reportCount = options?.reportCount ?? post.reportCount ?? 0;

  let mult =
    jurisFeedVelocityMultiplier(post, now) *
    jurisFeedRecencyMultiplier(post, now) *
    jurisFeedSpamMultiplier(reportCount) *
    jurisFeedSuspiciousEngagementMultiplier(post, now);

  const cap = JURISFEED_MAX_COMBINED_BOOST;
  if (mult > cap) mult = cap;

  return Math.round(jurisRankScore * mult * 100) / 100;
}
