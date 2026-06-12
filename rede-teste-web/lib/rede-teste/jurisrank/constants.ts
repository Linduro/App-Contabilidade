/** Pesos do JurisRank 2026 — ajustáveis sem alterar a lógica. */
export const JURISRANK_WEIGHTS = {
  authority: 0.4,
  engagement: 0.3,
  contentDepth: 0.2,
  relevance: 0.1,
} as const;

/** Multiplicador para autores no Top 10 "Os Fortes" (indicações no mês). */
export const OS_FORTES_BOOST = 1.3;

/** Comentários com menos caracteres contam pouco (anti-pod). */
export const MIN_SUBSTANTIVE_COMMENT_CHARS = 15;

/** Meia-vida da recência em dias (conteúdo novo de autores fortes sobe). */
export const RECENCY_HALF_LIFE_DAYS = 7;

/** Janela de engajamento inicial (minutos). */
export const EARLY_ENGAGEMENT_WINDOW_MIN = 60;

/** Penalidade se >70% dos comentários forem genéricos curtos. */
export const SHORT_REPLY_RATIO_PENALTY_THRESHOLD = 0.7;

export const CLICKBAIT_PATTERNS = [
  /você não vai acreditar/i,
  /chocante/i,
  /urgente!!!/i,
  /clique aqui/i,
  /inacreditável/i,
];
