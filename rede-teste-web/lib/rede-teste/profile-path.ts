/** URL pública do perfil no Rede Teste (não usar rotas do SaaS `/profile`). */
export function jqProfilePath(handle: string): string {
  const h = handle.replace(/^@/, "").trim().toLowerCase();
  return `/rede-teste/${encodeURIComponent(h)}`;
}
