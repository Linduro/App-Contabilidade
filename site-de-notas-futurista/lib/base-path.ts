/** Prefixo para assets estáticos (GitHub Pages). */
export function assetPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}
