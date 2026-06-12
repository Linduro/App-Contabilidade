import type { PrismaClient } from "@prisma/client";
import { sendReminderEmail } from "@/lib/mail";
import { log } from "@/lib/logger";

const ORIGIN = () =>
  (process.env.BETTER_AUTH_URL ?? "https://portal.com").replace(/\/$/, "");

export async function sendJqWelcomeEmail(
  prisma: PrismaClient,
  userId: string,
  email: string,
  name: string,
) {
  const template = "welcome";
  const exists = await prisma.redeTesteEmailEngagement.findUnique({
    where: { userId_template: { userId, template } },
  });
  if (exists) return;

  const ok = await sendReminderEmail(
    email,
    "Bem-vindo ao Rede Teste",
    `Olá, ${name}!\n\nBem-vindo ao Rede Teste — a rede social jurídica do Portal.\n\nComplete seu perfil: ${ORIGIN()}/rede-teste/onboarding\n\nDúvidas: ${ORIGIN()}/suporte\n\n— Equipe Portal`,
  );
  if (ok) {
    await prisma.redeTesteEmailEngagement.create({
      data: { userId, template },
    });
  }
}

export async function runJqEngagementEmailCron(prisma: PrismaClient) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const users = await prisma.user.findMany({
    where: { active: true, deletedAt: null, juridiquesProfile: { isNot: null } },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      juridiquesProfile: {
        select: {
          onboardingCompleted: true,
          publicationsCount: true,
        },
      },
    },
    take: 500,
  });

  for (const u of users) {
    const prefs = await prisma.redeTesteNotificationPreference.findUnique({
      where: { userId: u.id },
    });
    if (prefs?.marketingOptOut) continue;

    const ageDays = Math.floor((now - u.createdAt.getTime()) / day);
    const pubCount = u.juridiquesProfile?.publicationsCount ?? 0;

    let template: string | null = null;
    let subject = "";
    let text = "";

    if (ageDays >= 0 && ageDays < 1) {
      continue; // welcome enviado no onboarding
    } else if (ageDays >= 3 && ageDays < 4 && pubCount === 0) {
      template = "day3_no_post";
      subject = "Que tal sua primeira publicação?";
      text = `Olá, ${u.name}!\n\nVocê ainda não publicou no Rede Teste. Apresente-se à comunidade em ${ORIGIN()}/rede-teste\n\n— Rede Teste`;
    } else if (ageDays >= 7 && ageDays < 8 && pubCount < 3) {
      template = "day7_low_engagement";
      subject = "Conheça os recursos do Rede Teste";
      text = `Olá, ${u.name}!\n\nExplore tendências, mensagens sigilosas e comunidades: ${ORIGIN()}/rede-teste/explorar\n\n— Rede Teste`;
    } else if (ageDays >= 14 && ageDays < 15) {
      template = "day14_plans";
      subject = "Conheça os planos Rede Teste";
      text = `Olá, ${u.name}!\n\nAgende publicações, threads e mais: ${ORIGIN()}/billing\n\n— Rede Teste`;
    }

    if (!template) continue;

    const sent = await prisma.redeTesteEmailEngagement.findUnique({
      where: { userId_template: { userId: u.id, template } },
    });
    if (sent) continue;

    const ok = await sendReminderEmail(u.email, subject, text);
    if (ok) {
      await prisma.redeTesteEmailEngagement.create({
        data: { userId: u.id, template },
      });
      log.info("jq engagement email", { userId: u.id, template });
    }
  }
}
