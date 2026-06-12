import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

export const PORTAL_SESSION_COOKIE = "rt_portal_session"

export type PortalSession = {
  userId: string
  email: string
  name: string
}

function secret() {
  return process.env.BETTER_AUTH_SECRET || "rede-teste-dev-secret-change-me-32chars"
}

export function signPortalSession(payload: PortalSession): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = createHmac("sha256", secret()).update(body).digest("base64url")
  return `${body}.${sig}`
}

export function verifyPortalSessionToken(token: string): PortalSession | null {
  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = createHmac("sha256", secret()).update(body).digest("base64url")
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PortalSession
  } catch {
    return null
  }
}

export async function getPortalSessionFromCookies(): Promise<PortalSession | null> {
  const jar = await cookies()
  const raw = jar.get(PORTAL_SESSION_COOKIE)?.value
  if (!raw) return null
  return verifyPortalSessionToken(raw)
}

export function portalSessionCookieOptions(maxAgeSec = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  }
}
