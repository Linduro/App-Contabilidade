import type { PrismaClient } from "@prisma/client";
import {
  parseLinkPreview,
  type JqLinkPreview,
} from "@/lib/rede-teste/publication-dto";

export type DmPublicationPreview = {
  id: string;
  content: string;
  author: {
    displayName: string;
    handle: string;
    image: string | null;
  };
  media: { id: string; url: string; type: string }[];
  linkPreview: JqLinkPreview | null;
};

export type DmPublicationPreviewResult = DmPublicationPreview | { id: string; unavailable: true };

export function mapJqPublicationDtoToDmPreview(pub: {
  id: string;
  content: string;
  author: { name: string; handle: string; image: string | null };
  media: { id: string; url: string; type: string }[];
  linkPreview?: JqLinkPreview | null;
}): DmPublicationPreview {
  return {
    id: pub.id,
    content: pub.content,
    author: {
      displayName: pub.author.name,
      handle: pub.author.handle,
      image: pub.author.image,
    },
    media: pub.media,
    linkPreview: pub.linkPreview ?? null,
  };
}

export async function loadDmPublicationPreviews(
  prisma: PrismaClient,
  publicationIds: string[],
): Promise<Map<string, DmPublicationPreviewResult>> {
  const unique = [...new Set(publicationIds.filter(Boolean))];
  const map = new Map<string, DmPublicationPreviewResult>();
  if (!unique.length) return map;

  const pubs = await prisma.redeTestePublication.findMany({
    where: {
      id: { in: unique },
      deletedAt: null,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      content: true,
      linkPreview: true,
      author: {
        select: {
          image: true,
          juridiquesProfile: {
            select: { displayName: true, handle: true },
          },
        },
      },
      media: {
        orderBy: { order: "asc" },
        take: 4,
        select: { id: true, url: true, type: true },
      },
    },
  });

  for (const p of pubs) {
    const profile = p.author.juridiquesProfile;
    map.set(p.id, {
      id: p.id,
      content: p.content,
      author: {
        displayName: profile?.displayName ?? profile?.handle ?? "Usuário",
        handle: profile?.handle ?? "usuario",
        image: p.author.image,
      },
      media: p.media.map((m) => ({ id: m.id, url: m.url, type: m.type })),
      linkPreview: parseLinkPreview(p.linkPreview),
    });
  }

  for (const id of unique) {
    if (!map.has(id)) {
      map.set(id, { id, unavailable: true });
    }
  }

  return map;
}
