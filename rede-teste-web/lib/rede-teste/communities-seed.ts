import type { PrismaClient } from "@prisma/client";

const DEFAULT_COMMUNITIES = [
  {
    slug: "civel",
    name: "Cível e Consumidor",
    description: "Discussões sobre responsabilidade civil, contratos e CDC.",
  },
  {
    slug: "trabalhista",
    name: "Trabalhista",
    description: "Reclamações, rescisões, vínculos e negociações coletivas.",
  },
  {
    slug: "penal",
    name: "Penal e Processo Penal",
    description: "Defesa, investigação e estratégias em inquéritos e ações penais.",
  },
  {
    slug: "tributario",
    name: "Tributário",
    description: "Planejamento, contencioso e compliance fiscal.",
  },
  {
    slug: "startups",
    name: "Startups e Tech",
    description: "SaaS, contratos de investimento, LGPD e propriedade intelectual.",
  },
] as const;

export async function ensureRedeTesteCommunities(
  prisma: PrismaClient,
  tenantId: string,
) {
  const globalCount = await prisma.redeTesteCommunity.count();
  if (globalCount > 0) return;

  const creator =
    (await prisma.user.findFirst({
      where: { tenantId, tenantRole: "OWNER", active: true },
      select: { id: true },
    })) ??
    (await prisma.user.findFirst({
      where: { tenantId, active: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.user.findFirst({
      where: { active: true },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }));
  if (!creator) return;
  const ownerUserId = creator.id;
  const seedTenantId =
    (
      await prisma.user.findUnique({
        where: { id: ownerUserId },
        select: { tenantId: true },
      })
    )?.tenantId ?? tenantId;

  for (const c of DEFAULT_COMMUNITIES) {
    const community = await prisma.redeTesteCommunity.create({
      data: {
        tenantId: seedTenantId,
        slug: c.slug,
        name: c.name,
        description: c.description,
        isPrivate: false,
        createdById: ownerUserId,
        membersCount: 1,
      },
    });
    await prisma.redeTesteCommunityMember.create({
      data: {
        communityId: community.id,
        userId: ownerUserId,
        role: "ADMIN",
      },
    });
  }
}
