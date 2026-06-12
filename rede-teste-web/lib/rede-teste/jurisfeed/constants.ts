/**
 * Sinais JurisFeed 2026 aplicados como camada sobre o JurisRank (sem substituir pesos do ranking).
 * Ver JURISFEED_JURISCONNECT.md
 */

/** Janela de velocidade de engajamento (2h). */
export const JURISFEED_VELOCITY_WINDOW_MIN = 120;

/** Boost forte para posts com menos de 6h. */
export const JURISFEED_FRESH_BOOST_HOURS = 6;
export const JURISFEED_FRESH_BOOST_MAX = 1.18;

/** Após 48h o boost de recência JurisFeed decai rápido. */
export const JURISFEED_STALE_HOURS = 48;
export const JURISFEED_STALE_MULTIPLIER = 0.88;

/** Penalidade por denúncia (spam). */
export const JURISFEED_REPORT_PENALTY_PER = 0.08;
export const JURISFEED_REPORT_PENALTY_MAX = 0.4;

/** Pico suspeito: muito engajamento em poucos minutos com quase só comentários curtos. */
export const JURISFEED_SPIKE_MIN_ACTIONS = 25;
export const JURISFEED_SPIKE_MAX_AGE_MIN = 30;

/** Multiplicador máximo combinado (velocity + recency). */
export const JURISFEED_MAX_COMBINED_BOOST = 1.25;
