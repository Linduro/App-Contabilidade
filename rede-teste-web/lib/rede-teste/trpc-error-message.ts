/** Mensagem amigável em PT-BR a partir de erros de rede ou tRPC. */
export function jqErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const e = error as { message?: string; data?: { code?: string }; cause?: unknown };

  const msg = (e.message ?? "").toLowerCase();
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "A solicitação demorou demais. Tente novamente em instantes.";
  }
  if (e.data?.code === "UNAUTHORIZED") {
    return "Sua sessão expirou. Faça login novamente.";
  }
  if (e.data?.code === "FORBIDDEN") {
    return "Você não tem permissão para esta ação.";
  }
  if (e.data?.code === "NOT_FOUND") {
    return "Conteúdo não encontrado ou removido.";
  }
  if (e.data?.code === "TOO_MANY_REQUESTS") {
    return "Muitas tentativas em pouco tempo. Aguarde um momento.";
  }
  if (msg.includes("502") || msg.includes("bad gateway")) {
    return "O servidor está temporariamente indisponível. Tente em alguns minutos.";
  }
  if (msg.includes("500") || msg.includes("internal server")) {
    return "Erro interno do servidor. Nossa equipe foi notificada.";
  }

  return e.message && e.message.length < 120 ? e.message : fallback;
}
