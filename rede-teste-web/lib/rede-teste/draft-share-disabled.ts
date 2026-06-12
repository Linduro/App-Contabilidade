type IntimationShareInput = {
  id: string;
  summary: string | null;
  rawContent: string;
  cnjNumber: string | null;
  tribunalCode: string | null;
  courtCode: string | null;
  caseCnj: string | null;
};

export function buildIntimationShareContent(i: IntimationShareInput, origin: string) {
  const tribunal = i.courtCode ?? i.tribunalCode ?? "órgão";
  const processo = i.caseCnj ?? i.cnjNumber ?? "processo";
  const preview =
    i.summary?.trim() ||
    i.rawContent.trim().slice(0, 220) ||
    "Intimação compartilhada na Rede Teste.";

  return [
    `📋 Intimação — ${tribunal}`,
    `Processo: ${processo}`,
    "",
    preview,
    "",
    `Detalhes: ${origin}/rede-teste`,
  ].join("\n");
}
