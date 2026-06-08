/**
 * Template HTML para e-mail de novas licitações matched.
 */

/**
 * @param {number} score
 * @returns {string}
 */
function formatScorePercent(score) {
  return `${Math.round(Number(score) * 100)}%`;
}

/**
 * @param {string|null|undefined} valor
 * @returns {string}
 */
function formatValor(valor) {
  if (!valor) return "Não informado";
  return valor;
}

/**
 * @param {string|null|undefined} deadline
 * @returns {string}
 */
function formatDeadline(deadline) {
  if (!deadline) return "Não informado";

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return deadline;

  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * @param {{ advogadoNome: string, matches: Array<{ titulo: string, valor?: string|null, cidade?: string|null, deadline?: string|null, relevancia_score: number, url_fonte: string, especialidade_nome?: string }> }} params
 * @returns {string}
 */
export function buildMatchNotificationEmail({ advogadoNome, matches }) {
  const cards = matches
    .map(
      (match) => `
      <tr>
        <td style="padding:0 0 16px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;overflow:hidden;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">
                  ${match.especialidade_nome ?? "Especialidade jurídica"}
                </p>
                <h3 style="margin:0 0 16px 0;font-size:18px;line-height:1.4;color:#0f172a;font-family:Georgia,'Times New Roman',serif;">
                  ${match.titulo}
                </h3>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="33%" style="padding:0 8px 0 0;vertical-align:top;">
                      <p style="margin:0 0 4px 0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Valor</p>
                      <p style="margin:0;font-size:14px;color:#334155;font-weight:600;">${formatValor(match.valor)}</p>
                    </td>
                    <td width="33%" style="padding:0 8px;vertical-align:top;">
                      <p style="margin:0 0 4px 0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Cidade</p>
                      <p style="margin:0;font-size:14px;color:#334155;font-weight:600;">${match.cidade ?? "Não informada"}</p>
                    </td>
                    <td width="34%" style="padding:0 0 0 8px;vertical-align:top;">
                      <p style="margin:0 0 4px 0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">Prazo</p>
                      <p style="margin:0;font-size:14px;color:#334155;font-weight:600;">${formatDeadline(match.deadline)}</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                  <tr>
                    <td>
                      <span style="display:inline-block;background:#ecfdf5;color:#047857;font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px;">
                        Relevância ${formatScorePercent(match.relevancia_score)}
                      </span>
                    </td>
                    <td align="right">
                      <a href="${match.url_fonte}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;">
                        Ver edital →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Novas licitações para você</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
          <tr>
            <td style="padding:0 0 24px 0;text-align:center;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
                Licitações Advocacia
              </p>
              <h1 style="margin:0;font-size:28px;line-height:1.2;color:#0f172a;font-family:Georgia,'Times New Roman',serif;">
                Olá, ${advogadoNome}
              </h1>
              <p style="margin:12px 0 0 0;font-size:16px;line-height:1.6;color:#475569;">
                Encontramos <strong>${matches.length}</strong> licitação(ões) compatível(eis) com seu perfil jurídico.
              </p>
            </td>
          </tr>
          ${cards}
          <tr>
            <td style="padding:24px 0 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                Você recebeu este e-mail porque está cadastrado em Licitações Advocacia.<br />
                As oportunidades são classificadas automaticamente por NLP.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
