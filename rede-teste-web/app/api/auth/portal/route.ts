import { NextResponse } from "next/server"
import { getFirebaseAdminAuth } from "@/lib/firebase-admin"
import { prisma } from "@/lib/prisma"
import { provisionPortalUser } from "@/lib/provision-portal-user"
import {
  portalSessionCookieOptions,
  PORTAL_SESSION_COOKIE,
  signPortalSession,
} from "@/lib/portal-session"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { idToken?: string }
    if (!body.idToken) {
      return NextResponse.json({ error: "Token ausente" }, { status: 400 })
    }

    const decoded = await getFirebaseAdminAuth().verifyIdToken(body.idToken)
    const email = decoded.email
    if (!email) {
      return NextResponse.json({ error: "E-mail não encontrado no token" }, { status: 400 })
    }

    const user = await provisionPortalUser(prisma, {
      uid: decoded.uid,
      email,
      name: decoded.name || email.split("@")[0],
      image: decoded.picture ?? null,
    })

    const token = signPortalSession({
      userId: user.id,
      email: user.email,
      name: user.name,
    })

    const res = NextResponse.json({ ok: true, handle: user.email.split("@")[0] })
    res.cookies.set(PORTAL_SESSION_COOKIE, token, portalSessionCookieOptions())
    return res
  } catch (err) {
    console.error("[rede-teste] portal auth", err)
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 })
  }
}
