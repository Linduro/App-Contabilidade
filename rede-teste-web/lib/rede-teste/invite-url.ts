import { jqProfilePath } from "@/lib/rede-teste/profile-path";

/** Link de convite para o perfil público no Rede Teste. */
export function buildRedeTesteProfileInviteUrl(handle: string, origin?: string) {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "https://portal.com");
  const path = jqProfilePath(handle);
  return `${base}${path}?ref=${encodeURIComponent(handle.replace(/^@/, ""))}`;
}
