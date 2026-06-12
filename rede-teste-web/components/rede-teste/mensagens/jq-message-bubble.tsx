"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { trpc } from "@/lib/trpc-client";
import {
  dmMessageDisplayBody,
  resolveDmSharedPublicationId,
} from "@/lib/rede-teste/dm-publication-share";
import {
  mapJqPublicationDtoToDmPreview,
  type DmPublicationPreviewResult,
} from "@/lib/rede-teste/dm-publication-preview";
import { DmSharedPublicationCard } from "./dm-shared-publication-card";
import { cn } from "@/lib/utils";

export type JqMessageItem = {
  id: string;
  body: string;
  createdAt: Date | string;
  isMine: boolean;
  sharedPublicationId?: string | null;
  sharedPublication?: DmPublicationPreviewResult | null;
};

type Props = {
  message: JqMessageItem;
  showTime?: boolean;
  compact?: boolean;
};

export function JqMessageBubble({ message, showTime = true, compact }: Props) {
  const publicationId = resolveDmSharedPublicationId(
    message.sharedPublicationId,
    message.body,
  );

  const displayBody = dmMessageDisplayBody(message.body, publicationId);

  const hasServerPreview =
    message.sharedPublication &&
    !("unavailable" in message.sharedPublication);

  const needsClientFetch = !!publicationId && !hasServerPreview;

  const pubQuery = trpc.redeTeste.getPublication.useQuery(
    { id: publicationId! },
    { enabled: needsClientFetch, staleTime: 60_000 },
  );

  const preview = useMemo((): DmPublicationPreviewResult | null => {
    if (!publicationId) return null;
    if (hasServerPreview && message.sharedPublication) {
      return message.sharedPublication;
    }
    if (pubQuery.data) {
      return mapJqPublicationDtoToDmPreview(pubQuery.data);
    }
    if (
      message.sharedPublication &&
      "unavailable" in message.sharedPublication
    ) {
      return message.sharedPublication;
    }
    if (pubQuery.isError) {
      return { id: publicationId, unavailable: true };
    }
    return null;
  }, [
    publicationId,
    hasServerPreview,
    message.sharedPublication,
    pubQuery.data,
    pubQuery.isError,
  ]);

  const hasText = Boolean(displayBody.trim());
  const hasShare = Boolean(preview);

  return (
    <div className={cn("flex", message.isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl text-sm",
          compact ? "px-3 py-2" : "px-4 py-2",
          message.isMine
            ? "bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
            : "bg-[var(--jq-surface)] text-[var(--jq-text)]",
        )}
      >
        {hasText ? (
          <p className="whitespace-pre-wrap break-words">{displayBody}</p>
        ) : null}
        {hasShare && preview ? (
          <DmSharedPublicationCard preview={preview} isMine={message.isMine} />
        ) : publicationId && pubQuery.isLoading ? (
          <p className="mt-2 text-xs opacity-70">Carregando publicação…</p>
        ) : null}
        {!hasText && !hasShare && !publicationId ? (
          <p className="text-xs opacity-70">Mensagem vazia</p>
        ) : null}
        {showTime ? (
          <time className="mt-1 block text-[10px] opacity-70">
            {format(new Date(message.createdAt), "dd/MM HH:mm", { locale: ptBR })}
          </time>
        ) : null}
      </div>
    </div>
  );
}
