/** Badge OAB no Rede Teste: Beta até validação no registro (OAB_REGISTRY_VERIFY). */

export function isOabRegistryVerifiedEnv() {
  return (
    process.env.OAB_REGISTRY_VERIFY === "true" ||
    process.env.NEXT_PUBLIC_OAB_REGISTRY_VERIFY === "true"
  );
}

/** Exibir selo Beta ao lado do ícone de advogado. */
export function showJqOabBetaBadge() {
  return !isOabRegistryVerifiedEnv();
}
