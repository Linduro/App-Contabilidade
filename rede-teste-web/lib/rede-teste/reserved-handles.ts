/** Rotas estáticas do Rede Teste — não podem ser @handle de perfil. */
export const JQ_RESERVED_HANDLES = new Set([
  "explorar",
  "mensagens",
  "notificacoes",
  "conexoes",
  "configuracoes",
  "comunidades",
  "salvos",
  "moderacao",
  "ia",
  "publicacao",
  "p",
  "api",
]);

export function isReservedJqHandle(handle: string): boolean {
  return JQ_RESERVED_HANDLES.has(handle.replace(/^@/, "").toLowerCase());
}
