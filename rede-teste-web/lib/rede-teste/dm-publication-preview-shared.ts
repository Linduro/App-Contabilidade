import type { JqLinkPreview } from "@/lib/rede-teste/link-preview-parsers";

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
