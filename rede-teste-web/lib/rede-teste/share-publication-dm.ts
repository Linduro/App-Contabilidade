/** Corpo padrão quando não há comentário (evita URL cru no chat). */
export const DM_PUBLICATION_SHARE_BODY = "📎 Publicação compartilhada";

export function buildPublicationShareDmBody(note?: string): string {
  const trimmed = note?.trim();
  return trimmed || DM_PUBLICATION_SHARE_BODY;
}
