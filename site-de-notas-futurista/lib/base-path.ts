/** Prefixo para assets estáticos (GitHub Pages). Não use em Link/router — o Next.js aplica basePath sozinho. */
export function assetPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}
