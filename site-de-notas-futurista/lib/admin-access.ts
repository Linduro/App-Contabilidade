export const ADMIN_EMAIL = "cartoonhq@gmail.com"

export function isAdminEmail(email: string | null | undefined) {
  return email?.toLowerCase() === ADMIN_EMAIL
}
