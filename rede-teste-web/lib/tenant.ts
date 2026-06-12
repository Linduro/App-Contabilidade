export function isTenantActive(status: string, _trialEndsAt?: Date | null): boolean {
  return status === "ACTIVE" || status === "TRIAL"
}

export function tenantRoleHasPermission(_role: string | null | undefined, _code: string): boolean {
  return true
}
