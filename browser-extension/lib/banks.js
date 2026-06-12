/** Exequentes / credores bancários frequentes em execuções */
const BANK_SEARCH_TERMS = [
  "BANCO DO BRASIL",
  "BRADESCO",
  "ITAU",
  "ITAÚ",
  "SANTANDER",
  "CAIXA ECONOMICA",
  "CAIXA ECONÔMICA",
  "SAFRA",
  "BTG PACTUAL",
  "BANCO PAN",
  "BANCO BMG",
  "BANCO INTER",
  "BANCO ORIGINAL",
  "BANCO VOTORANTIM",
  "BANCO DAYCOVAL",
  "BANCO RENDIMENTO",
  "BANCO ABC",
  "BANCO SOFISA",
  "BANCO MODAL",
  "BANCO PINE",
  "BANCO MASTER",
  "BANCO AGIBANK",
  "BANCO DIGI",
  "NU FINANCEIRA",
  "NU PAGAMENTOS",
  "CREFISA",
  "OLE CONSIGNADO",
  "BANCO C6",
  "BANCO BS2",
  "BANCO GENIAL",
]

const BANK_NAME_RE =
  /banco|financeira|credito|cr[eé]dito|nubank|caixa econ|bradesco|itau|itaú|santander|safra|btg|crefisa|agibank|pan\b|bmg|inter\b|c6 bank|daycoval|votorantim/i

function looksLikeBank(text) {
  return BANK_NAME_RE.test(String(text || ""))
}

if (typeof globalThis !== "undefined") {
  globalThis.CaptacaoBanks = { BANK_SEARCH_TERMS, BANK_NAME_RE, looksLikeBank }
}
