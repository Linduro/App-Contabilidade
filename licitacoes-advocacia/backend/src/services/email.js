import { Resend } from "resend";
import { buildMatchNotificationEmail } from "../templates/matchNotificationEmail.js";

const resendApiKey = process.env.RESEND_API_KEY ?? "";
const emailFrom = process.env.EMAIL_FROM ?? "Licitações Advocacia <alertas@exemplo.com>";

/**
 * @param {{ to: string, advogadoNome: string, matches: Array<Record<string, unknown>> }} params
 * @returns {Promise<{ id?: string, skipped?: boolean }>}
 */
export async function sendMatchNotificationEmail({
  to,
  advogadoNome,
  matches,
}) {
  if (!resendApiKey) {
    console.warn(
      `[email] RESEND_API_KEY não configurada — e-mail para ${to} não enviado (dry-run).`,
    );
    console.warn(
      `[email] Dry-run: ${matches.length} licitação(ões) para ${advogadoNome}`,
    );
    return { skipped: true };
  }

  const resend = new Resend(resendApiKey);
  const html = buildMatchNotificationEmail({ advogadoNome, matches });

  const { data, error } = await resend.emails.send({
    from: emailFrom,
    to: [to],
    subject: `${matches.length} nova(s) licitação(ões) jurídica(s) para você`,
    html,
  });

  if (error) {
    throw new Error(`Resend: ${error.message}`);
  }

  return { id: data?.id };
}

export function isEmailConfigured() {
  return Boolean(resendApiKey && emailFrom);
}
