import { getTeorPreview } from "@/lib/intimation-teor";
import {
  formatPartiesBlock,
  resolveIntimationParties,
  type CasePartiesFallback,
} from "@/lib/intimation-parties";

type IntimationShareInput = {
  id: string;
  summary: string | null;
  rawContent: string;
  cnjNumber: string | null;
  tribunalCode: string | null;
  courtCode: string | null;
  caseCnj: string | null;
  poloAtivo?: string[] | null;
  poloPassivo?: string[] | null;
  caseParties?: CasePartiesFallback | null;
};

export function buildIntimationShareContent(i: IntimationShareInput, origin: string) {
  const tribunal = i.courtCode ?? i.tribunalCode ?? "órgão";
  const processo = i.caseCnj ?? i.cnjNumber ?? "processo";
  const parties = resolveIntimationParties(
    {
      poloAtivo: i.poloAtivo,
      poloPassivo: i.poloPassivo,
      rawContent: i.rawContent,
    },
    i.caseParties ?? null,
  );
  const partyLines = formatPartiesBlock(parties);
  const preview =
    i.summary?.trim() ||
    getTeorPreview(i.rawContent, 220) ||
    "Intimação capturada no Portal.";
  const link = `${origin}/intimacoes/nao-lidas`;

  return [
    `📋 Intimação — ${tribunal}`,
    `Processo: ${processo}`,
    ...partyLines,
    "",
    preview,
    "",
    `Detalhes no Portal: ${link}`,
  ].join("\n");
}
