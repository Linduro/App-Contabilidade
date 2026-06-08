/** Normaliza texto para comparação (sem acentos, minúsculas). */
export function normalizeLegalText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

/** Termos que indicam contratação de serviços jurídicos/advocatícios. */
const STRONG_LEGAL_PATTERNS = [
  /\badvocac/i,
  /\badvocat/i,
  /\badvogad/i,
  /\boab\b/i,
  /\bassessoria\s+jur/i,
  /\bconsultoria\s+jur/i,
  /\bescritorio\s+de\s+advoc/i,
  /\bservic\w*\s+advocat/i,
  /\bprocuradoria\b/i,
  /\bdefensoria\b/i,
  /\bhonorari\w*\s+advocat/i,
  /\brepresentacao\s+judicial/i,
  /\bcontencioso\b/i,
  /\bnatureza\s+juridica\b/i,
  /\barea\s+juridica\b/i,
  /\bdireito\s+(do\s+)?trabalho\b/i,
  /\bparecer\s+jur/i,
  /\bcredenciamento\s+de\s+advogad/i,
  /\bprograma\s+advoga/i,
]

/** Objetos claramente não jurídicos — rejeitar se dominarem o texto. */
const NON_LEGAL_OBJECT_PATTERNS = [
  /\bengenharia\b/,
  /\barquitetura\b/,
  /\bconstruc\w*\b/,
  /\bobra\b/,
  /\bpavimenta\w*\b/,
  /\basfalto\b/,
  /\bsoftware\b/,
  /\binformatica\b/,
  /\bequipamento\b/,
  /\bmaterial\s+de\s+construc/i,
  /\bmanutenc\w*\s+predial/i,
  /\bveiculo\b/,
  /\bcombustivel\b/,
  /\balimentacao\b/,
  /\bmerenda\b/,
]

const ADVOCACY_SPECIFIC =
  /\badvocac|\badvocat|\badvogad|escritorio de advoc|servic\w* advocat|assessoria jur|consultoria jur|\boab\b|procuradoria|defensoria|honorari\w* advocat|credenciamento de advogad/i

/**
 * Verifica se o objeto/descrição é contratação jurídica real.
 * Rejeita falsos positivos como "pessoa jurídica" em editais de engenharia.
 */
export function isLegitimateLegalTender(text: string): boolean {
  const t = normalizeLegalText(text)
  if (!t.trim()) return false

  const hasStrong = STRONG_LEGAL_PATTERNS.some((re) => re.test(t))
  if (!hasStrong) return false

  const hasNonLegal = NON_LEGAL_OBJECT_PATTERNS.some((re) => re.test(t))
  if (hasNonLegal && !ADVOCACY_SPECIFIC.test(t)) return false

  return true
}
