import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getPortalSessionFromCookies } from "@/lib/portal-session"
import { RedeTesteShell } from "@/components/rede-teste/juridiques-shell"
import { normalizeMediaUrl } from "@/lib/uploads"

function portalEntryUrl() {
  const portal =
    process.env.NEXT_PUBLIC_PORTAL_URL ||
    "https://linduro.github.io/App-Contabilidade"
  return `${portal}/dashboard/rede-teste/`
}

export default async function RedeTesteRootLayout({
  children,
}: {
  children: ReactNode
}) {
  const portalSession = await getPortalSessionFromCookies()
  if (!portalSession) {
    redirect(portalEntryUrl())
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: portalSession.userId },
    select: { name: true, email: true, image: true },
  })

  const user = {
    name: dbUser?.name ?? portalSession.name,
    email: dbUser?.email ?? portalSession.email,
    image: normalizeMediaUrl(dbUser?.image ?? null),
  }

  return <RedeTesteShell user={user}>{children}</RedeTesteShell>
}
