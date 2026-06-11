/** Base URL da API Flask do AFS Market Intelligence (sem barra final). */
export function getAfsMarketApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_AFS_MARKET_API_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")

  if (process.env.NEXT_PUBLIC_GITHUB_PAGES === "true") {
    return ""
  }

  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "")
  return `${basePath}/afs-market-api`.replace(/\/+/g, "/") || "/afs-market-api"
}

export function getAfsMarketAppPath(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
  return `${basePath}/afs-market-intelligence/index.html`
}

export function isAfsMarketApiConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_AFS_MARKET_API_URL?.trim()) return true
  return process.env.NEXT_PUBLIC_GITHUB_PAGES !== "true"
}
