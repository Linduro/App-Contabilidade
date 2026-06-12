export const JQ_PROFESSIONAL_KINDS = [
  "ADVOGADO",
  "ESTAGIARIO",
  "PROCURADOR",
  "DEFENSOR",
  "JUIZ",
  "PROMOTOR",
  "ESCRITORIO",
  "ACADEMICO",
] as const;

export type JqProfessionalKind = (typeof JQ_PROFESSIONAL_KINDS)[number];

export const JQ_PROFESSIONAL_KIND_LABELS: Record<JqProfessionalKind, string> = {
  ADVOGADO: "Advogado(a)",
  ESTAGIARIO: "Estagiário(a)",
  PROCURADOR: "Procurador(a)",
  DEFENSOR: "Defensor(a)",
  JUIZ: "Juiz(a)",
  PROMOTOR: "Promotor(a)",
  ESCRITORIO: "Escritório",
  ACADEMICO: "Acadêmico",
};
