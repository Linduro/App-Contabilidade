/** Subpasta discreta no GitHub Pages (mesmo domínio do portal). */
export const GITHUB_SITE_BASE = "/App-Contabilidade"
export const NETWORKING_PAGES_SEGMENT = "_internal/f7c2-network"

export function githubNetworkingBasePath(): string {
  return `${GITHUB_SITE_BASE}/${NETWORKING_PAGES_SEGMENT}`
}
