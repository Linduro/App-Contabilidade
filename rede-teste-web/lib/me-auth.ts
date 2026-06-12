import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPortalSessionFromCookies,
  verifyPortalSessionToken,
  PORTAL_SESSION_COOKIE,
} from "@/lib/portal-session";

const GLOBAL_TENANT_ID = "rede-teste-global";

async function resolveUserId(req: Request): Promise<string | null> {
  const portalRaw = req.headers.get("cookie")?.match(
    new RegExp(`${PORTAL_SESSION_COOKIE}=([^;]+)`),
  )?.[1];
  if (portalRaw) {
    const portal = verifyPortalSessionToken(decodeURIComponent(portalRaw));
    if (portal?.userId) return portal.userId;
  }

  const portalFromCookies = await getPortalSessionFromCookies();
  if (portalFromCookies?.userId) return portalFromCookies.userId;

  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user?.id ?? null;
}

export async function requireApiSession(req: Request) {
  const userId = await resolveUserId(req);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { juridiquesProfile: true },
  });
  if (!user) return null;

  const tenantId = user.tenantId ?? GLOBAL_TENANT_ID;
  if (!user.tenantId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { tenantId: GLOBAL_TENANT_ID, tenantRole: "ADMIN" },
    });
  }

  return {
    session: { userId: user.id },
    user: { ...user, tenantId },
  };
}
