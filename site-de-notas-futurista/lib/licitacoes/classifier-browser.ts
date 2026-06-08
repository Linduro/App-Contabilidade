import { normalizeLegalText } from "@/lib/licitacoes/legal-relevance"

const KEYWORDS: Record<string, string[]> = {
  responsabilidade_civil: [
    "indenizacao",
    "danos morais",
    "danos materiais",
    "sinistro",
    "responsabilidade civil",
  ],
  banking_law: [
    "direito bancario",
    "contrato bancario",
    "instituicao financeira",
    "credito",
    "hipoteca",
    "financiamento",
  ],
  tributario: [
    "direito tributario",
    "consultoria tributaria",
    "imposto",
    "icms",
    "iss",
    "execucao fiscal",
    "divida ativa",
    "fiscal tributario",
  ],
  administrativo: [
    "direito administrativo",
    "licitacao",
    "contratacao publica",
    "edital",
    "pregao",
    "inexigibilidade",
    "dispensa",
  ],
  security: [
    "direito previdenciario",
    "inss",
    "beneficio previdenciario",
    "pericia medica",
    "aposentadoria",
    "previdenciario",
  ],
}

export interface Classificacao {
  especialidade: string
  score: number
}

function includesKeyword(text: string, keyword: string): boolean {
  const k = normalizeLegalText(keyword)
  if (k.includes(" ")) {
    return text.includes(k)
  }
  const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
  return re.test(text)
}

export function classifyTextBrowser(
  texto: string,
  minConfidence = 0.5,
): Classificacao[] {
  const normalized = normalizeLegalText(texto)
  const results: Classificacao[] = []

  for (const [slug, keywords] of Object.entries(KEYWORDS)) {
    let hits = 0
    for (const kw of keywords) {
      if (includesKeyword(normalized, kw)) hits += 1
    }
    if (hits === 0) continue

    const score = Math.min(0.4 + hits * 0.2, 0.95)
    if (score >= minConfidence) {
      results.push({ especialidade: slug, score })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

/** Classifica licitação jurídica genérica quando não há match de especialidade. */
export function classifyLegalTenderFallback(texto: string): Classificacao | null {
  const normalized = normalizeLegalText(texto)
  const legalHits = [
    "advocacia",
    "advocaticio",
    "advogado",
    "assessoria juridica",
    "consultoria juridica",
    "procuradoria",
    "defensoria",
    "contencioso",
    "honorarios advocaticios",
  ].filter((kw) => normalized.includes(kw)).length

  if (legalHits === 0) return null

  return {
    especialidade: "administrativo",
    score: Math.min(0.55 + legalHits * 0.1, 0.85),
  }
}
