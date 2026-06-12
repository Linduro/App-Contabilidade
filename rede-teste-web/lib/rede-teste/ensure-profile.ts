import type { PrismaClient } from "@prisma/client";
import { slugifyHandle } from "./format";

async function pickUniqueHandle(prisma: PrismaClient, base: string) {
  let handle = base;
  let n = 1;
  while (
    await prisma.redeTesteProfile.findFirst({
      where: { handle },
      select: { userId: true },
    })
  ) {
    handle = `${base}${n}`;
    n += 1;
  }
  return handle;
}

export async function ensureRedeTesteProfile(
  prisma: PrismaClient,
  userId: string,
  tenantId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, bio: true, oabNumber: true, oabUf: true },
  });
  if (!user) throw new Error("Usuário não encontrado");

  const baseName = user.name || user.email.split("@")[0] || "user";
  const base = slugifyHandle(baseName);
  const oabVerified = !!(user.oabNumber && user.oabUf);

  const existing = await prisma.redeTesteProfile.findUnique({
    where: { userId },
    select: { handle: true },
  });

  const handle = existing?.handle ?? (await pickUniqueHandle(prisma, base));

  return prisma.redeTesteProfile.upsert({
    where: { userId },
    create: {
      userId,
      tenantId,
      handle,
      displayName: user.name,
      bio: user.bio?.slice(0, 280) ?? null,
      oabVerified,
      verificationType: oabVerified ? "LAWYER" : "NONE",
      practiceAreas: [],
    },
    update: {},
  });
}
