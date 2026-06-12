/** Pesos JurisConnect — recomendação de seguidores. */
export const JURISCONNECT_WEIGHTS = {
  commonInterests: 0.4,
  mutualFollowers: 0.3,
  professionalProximity: 0.2,
  engagementPotential: 0.1,
} as const;

/** Mínimo de seguidores em comum para mencionar no motivo. */
export const JURISCONNECT_MUTUAL_REASON_MIN = 2;

/** Máximo de recomendações por área (diversificação). */
export const JURISCONNECT_MAX_PER_AREA = 2;

/** Pool de candidatos antes do score completo. */
export const JURISCONNECT_CANDIDATE_POOL = 120;

/** Idade máxima do cache de recomendações (horas). */
export const JURISCONNECT_CACHE_MAX_HOURS = 24;
