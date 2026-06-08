const KEYWORDS: Record<string, string[]> = {
  responsabilidade_civil: [
    "indenização",
    "indenizacao",
    "danos",
    "sinistro",
    "responsabilidade civil",
  ],
  banking_law: [
    "banco",
    "bancário",
    "bancario",
    "financeira",
    "crédito",
    "credito",
    "hipoteca",
    "financiamento",
  ],
  tributario: [
    "imposto",
    "tributo",
    "tributário",
    "tributario",
    "icms",
    "iss",
    "declaração",
    "declaracao",
    "fiscal",
    "execução fiscal",
    "execucao fiscal",
    "dívida ativa",
    "divida ativa",
  ],
  administrativo: [
    "contrato",
    "edital",
    "licitação",
    "licitacao",
    "pregão",
    "pregao",
    "administrativo",
    "contratação pública",
    "contratacao publica",
    "consultoria",
    "assessoria",
    "parecer",
    "compliance",
    "governança",
    "governanca",
  ],
  security: [
    "inss",
    "benefício",
    "beneficio",
    "perícia",
    "pericia",
    "aposentadoria",
    "previdenciário",
    "previdenciario",
  ],
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export interface Classificacao {
  especialidade: string
  score: number
}

export function classifyTextBrowser(
  texto: string,
  minConfidence = 0.25,
): Classificacao[] {
  const normalized = normalize(texto)
  const results: Classificacao[] = []

  for (const [slug, keywords] of Object.entries(KEYWORDS)) {
    let hits = 0
    for (const kw of keywords) {
      if (normalized.includes(normalize(kw))) hits += 1
    }
    if (hits === 0) continue

    const score = Math.min(0.35 + hits * 0.2, 0.95)
    if (score >= minConfidence) {
      results.push({ especialidade: slug, score })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}
