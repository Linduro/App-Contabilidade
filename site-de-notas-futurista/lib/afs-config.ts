/** Base URL da API Flask do AFS (sem barra final). */
export function getAfsApiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_AFS_API_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")

  if (process.env.NEXT_PUBLIC_GITHUB_PAGES === "true") {
    return ""
  }

  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "")
  return `${basePath}/afs-api`.replace(/\/+/g, "/") || "/afs-api"
}

export function getAfsAppPath(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
  return `${basePath}/afs-valuation/index.html`
}

export function isAfsApiConfigured(): boolean {
  if (process.env.NEXT_PUBLIC_AFS_API_URL?.trim()) return true
  return process.env.NEXT_PUBLIC_GITHUB_PAGES !== "true"
}
