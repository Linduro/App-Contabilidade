import type { PrismaClient } from "@prisma/client";
import { JURIDIQUES_COURTS_CATALOG } from "./courts-catalog";

let seeded = false;

export async function ensureCourtsCatalog(prisma: PrismaClient) {
  if (seeded) return;
  const count = await prisma.court.count();
  if (count > 0) {
    seeded = true;
    return;
  }

  await prisma.court.createMany({
    data: JURIDIQUES_COURTS_CATALOG.map((c) => ({
      code: c.code,
      name: c.name,
      jurisdiction: c.jurisdiction,
      state: c.state,
      active: true,
    })),
    skipDuplicates: true,
  });
  seeded = true;
}
