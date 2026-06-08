import type { Licitacao, MatchStatus, NivelExperiencia } from "@/types";

export function truncate(text: string, max = 60): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatRelevancia(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function getLicitacaoValor(licitacao: Licitacao): number | null {
  if (licitacao.valor_estimado != null) return licitacao.valor_estimado;

  const bruto = licitacao.dados_brutos as { valor?: string } | null;
  if (!bruto?.valor) return null;

  const digits = bruto.valor
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getLicitacaoCidade(licitacao: Licitacao): string {
  const bruto = licitacao.dados_brutos as { cidade?: string } | null;
  if (bruto?.cidade) return bruto.cidade;

  return [licitacao.municipio, licitacao.uf].filter(Boolean).join(" - ") || "—";
}

export function getLicitacaoDeadline(licitacao: Licitacao): string | null {
  const bruto = licitacao.dados_brutos as { deadline?: string } | null;
  return bruto?.deadline ?? licitacao.data_encerramento;
}

export function getStatusLabel(status: MatchStatus): string {
  const labels: Record<MatchStatus, string> = {
    novo: "Novo",
    visto: "Visto",
    inscrito: "Inscrito",
    arquivado: "Arquivado",
  };
  return labels[status];
}

export function getNivelLabel(nivel: NivelExperiencia): string {
  const labels: Record<NivelExperiencia, string> = {
    iniciante: "Iniciante",
    intermediario: "Intermediário",
    avancado: "Avançado",
    especialista: "Especialista",
  };
  return labels[nivel];
}

export function startOfCurrentMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

export function parseCategories(motivo: string | null): string[] {
  if (!motivo) return [];
  const match = motivo.match(/NLP:\s*([^\s(]+)/);
  if (!match) return [];
  return [match[1].replace(/_/g, " ")];
}
