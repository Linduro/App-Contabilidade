/** Itens de navegação Rede Teste (filtrados por flags públicas). */

export function isRedeTesteIaNavEnabled() {
  return (
    process.env.NEXT_PUBLIC_JURIDIQUES_IA_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_JURIDIQUES_ASSISTANT_ENABLED === "true"
  );
}

/** Estagiário Artificial (Gemini) — visível por padrão; desligue com NEXT_PUBLIC_JURIDIQUES_ASSISTANT_ENABLED=false */
export function isRedeTesteAssistantNavEnabled() {
  return process.env.NEXT_PUBLIC_JURIDIQUES_ASSISTANT_ENABLED !== "false";
}
