import { isTRPCClientError, type TRPCClientError } from "@trpc/client";

const PARSE_ERROR_HINT =
  "Tente atualizar a página (F5) ou fazer login de novo. Se persistir, verifique os logs do servidor.";

function isHtmlParseNoise(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("<!doctype") ||
    lower.includes("unexpected token '<'") ||
    lower.includes("unable to transform response") ||
    lower.includes("unable to parse") ||
    lower.includes("failed to parse")
  );
}

function formatZodLikeMessage(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("[") || !t.includes("invalid")) return t;
  try {
    const parsed = JSON.parse(t) as Array<{ message?: string; path?: (string | number)[] }>;
    const first = parsed[0];
    if (first?.message) {
      const field = first.path?.join(".") ?? "";
      if (field === "userId" && first.message.toLowerCase().includes("cuid")) {
        return "Usuário inválido. Atualize a página (F5) e tente salvar de novo.";
      }
      return field ? `${field}: ${first.message}` : first.message;
    }
  } catch {
    /* not JSON */
  }
  return t;
}

function extractTrpcMessage(error: TRPCClientError<unknown>): string {
  const shapeMsg =
    typeof error.shape?.message === "string" ? error.shape.message.trim() : "";
  const top = (error.message ?? "").trim();
  if (shapeMsg && !isHtmlParseNoise(shapeMsg)) return formatZodLikeMessage(shapeMsg);
  if (top && !isHtmlParseNoise(top)) return formatZodLikeMessage(top);
  return "";
}

function baseMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;

  if (isTRPCClientError(error)) {
    const code = error.data?.code;
    const msg = extractTrpcMessage(error);

    if (msg) {
      if (code === "UNAUTHORIZED") return "Sua sessão expirou. Faça login novamente.";
      if (code === "FORBIDDEN") return "Você não tem permissão para esta ação.";
      if (code === "NOT_FOUND") return "Conteúdo não encontrado ou removido.";
      return msg;
    }

    if (isHtmlParseNoise(error.message ?? "")) {
      return `Não foi possível ler a resposta do servidor. ${PARSE_ERROR_HINT}`;
    }

    if (code === "BAD_GATEWAY") {
      return "O serviço externo (LinkLei) respondeu com erro. Tente de novo em instantes.";
    }

    return fallback;
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
    }
    if (isHtmlParseNoise(error.message)) {
      return `Não foi possível ler a resposta do servidor. ${PARSE_ERROR_HINT}`;
    }
    if (error.message.length < 900) return error.message;
    return fallback;
  }

  return fallback;
}

/** @deprecated use trpcErrorMessage */
export function getTrpcErrorMessage(err: unknown, fallback = "Erro na operação"): string {
  return trpcErrorMessage(err, fallback);
}

export function trpcErrorMessage(error: unknown, fallback: string): string {
  return baseMessage(error, fallback);
}

export function formatTrpcErrorMessage(
  error: unknown,
  fallback = "Não foi possível concluir a operação.",
): string {
  return baseMessage(error, fallback);
}
