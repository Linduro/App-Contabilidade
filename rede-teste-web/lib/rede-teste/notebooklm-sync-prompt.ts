export type assistantSyncPromptInput = {
  selectedPromptTitle?: string | null;
  selectedArea?: string | null;
  clientName?: string | null;
  caseLabel?: string | null;
  bookmarkSnippets?: string[];
  pdfNames?: string[];
};

/** Texto enviado ao chat do assistant após o PDF estar nas fontes do caderno. */
export function buildassistantSyncPrompt(input: assistantSyncPromptInput): string {
  const piece = input.selectedPromptTitle?.trim() || "peça jurídica";
  const area = input.selectedArea?.trim() || "Geral";
  const client = input.clientName?.trim() || "cliente não informado";

  const lines: string[] = [];
  lines.push(`Faça pra mim ${piece} (${area}), estou pelo ${client}.`);

  const snippets = (input.bookmarkSnippets ?? []).map((s) => s.trim()).filter(Boolean);
  if (snippets.length) {
    lines.push("");
    lines.push("use esta(s) jurisprudência(s):");
    for (const snippet of snippets) {
      lines.push(snippet.length > 2500 ? `${snippet.slice(0, 2500)}…` : snippet);
    }
  }

  const fontes: string[] = [];
  if (input.caseLabel?.trim()) fontes.push(`processo ${input.caseLabel.trim()}`);
  if (input.pdfNames?.length) {
    fontes.push(`PDF(s): ${input.pdfNames.join(", ")}`);
  }
  if (fontes.length) {
    lines.push("");
    lines.push(`tendo como fonte ${fontes.join("; ")}.`);
  }

  lines.push("");
  lines.push("Seja robusto e prolixo, use o palavreado de praxe do judiciário.");

  return lines.join("\n");
}
