/** RBAC simplificado — Rede Teste não usa permissões AdvForte. */
export async function getUserPermissions(_userId: string): Promise<Set<string>> {
  return new Set(["rede_teste.use"])
}

export async function hasPermission(_userId: string, _code: string): Promise<boolean> {
  return true
}
