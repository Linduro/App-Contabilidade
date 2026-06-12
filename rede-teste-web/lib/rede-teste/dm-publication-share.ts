import { DM_PUBLICATION_SHARE_BODY } from "@/lib/rede-teste/share-publication-dm";

const PUBLICATION_PATH_RE = /\/rede-teste\/publicacao\/([a-z0-9]+)/i;

export function parsePublicationIdFromDmBody(body: string): string | null {
  const m = body.match(PUBLICATION_PATH_RE);
  return m?.[1] ?? null;
}

function isPublicationShareUrlLine(line: string, publicationId: string): boolean {
  if (!line) return false;
  return PUBLICATION_PATH_RE.test(line) && line.includes(publicationId);
}

/** Texto da mensagem sem a linha do link da publicação compartilhada. */
export function dmBodyNoteWithoutPublicationLink(
  body: string,
  publicationId: string,
): string | null {
  const lines = body.split("\n");
  const kept = lines.filter((line) => !isPublicationShareUrlLine(line.trim(), publicationId));
  const note = kept.join("\n").trim();
  return note || null;
}

export function resolveDmSharedPublicationId(
  sharedPublicationId: string | null | undefined,
  body: string,
): string | null {
  return sharedPublicationId ?? parsePublicationIdFromDmBody(body);
}

/** Texto visível no balão (sem link nem marcador padrão). */
export function dmMessageDisplayBody(
  body: string,
  publicationId: string | null,
): string {
  if (!publicationId) return body;
  const note = dmBodyNoteWithoutPublicationLink(body, publicationId);
  if (note) return note;
  if (body.trim() === DM_PUBLICATION_SHARE_BODY) return "";
  return "";
}
