import type { PrismaClient } from "@prisma/client";
import { normalizeJqHandle } from "@/lib/rede-teste/publication-dto";

export async function tryRecordJqReferral(
  prisma: PrismaClient,
  opts: {
    tenantId: string;
    referredUserId: string;
    refHandle?: string | null;
    source?: string;
  },
) {
  const handle = opts.refHandle?.trim();
  if (!handle) return;

  const referrer = await prisma.redeTesteProfile.findFirst({
    where: {
      tenantId: opts.tenantId,
      handle: normalizeJqHandle(handle),
    },
    select: { userId: true },
  });
  if (!referrer || referrer.userId === opts.referredUserId) return;

  await prisma.redeTesteReferral.upsert({
    where: { referredUserId: opts.referredUserId },
    create: {
      tenantId: opts.tenantId,
      referrerUserId: referrer.userId,
      referredUserId: opts.referredUserId,
      source: opts.source ?? "profile_follow",
    },
    update: {},
  });
}
