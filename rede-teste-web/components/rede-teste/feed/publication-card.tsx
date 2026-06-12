"use client";

import Link from "next/link";
import {
  MessageCircle,
  Repeat2,
  Heart,
  BarChart2,
  Bookmark,
  Share2,
  Lock,
  Layers,
} from "lucide-react";
import { PublicationMoreMenu } from "./publication-more-menu";
import { PublicationComposer } from "../composer/publication-composer";
import { trpc } from "@/lib/trpc-client";
import { JqAvatar } from "../shared/jq-avatar";
import { JqVerifiedBadge } from "../shared/jq-verified-badge";
import { PracticeAreaTag } from "../shared/practice-area-tag";
import { formatJqHandle, formatJqRelativeTime } from "@/lib/rede-teste/format";
import { RichTextContent } from "../shared/rich-text-content";
import { PublicationMedia } from "./publication-media";
import { PublicationPoll } from "./publication-poll";
import { PublicationLinkPreview } from "./publication-link-preview";
import { YouTubeEmbed } from "./youtube-embed";
import { findYouTubeIdInText, parseYouTubeId } from "@/lib/rede-teste/youtube";
import type { JqPollStored } from "@/lib/rede-teste/poll";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import { useRegisterPublicationView } from "./use-register-view";
import { showJqOabBetaBadge } from "@/lib/rede-teste/oab-badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";
import { JqMediaLightbox } from "../shared/jq-media-lightbox";
import { JurisFeedCard, type JurisFeedCardData } from "../jurisprudencia/juris-feed-card";

export type PublicationItem = {
  id: string;
  content: string;
  practiceArea: string | null;
  createdAt: Date;
  likesCount: number;
  repostsCount: number;
  repliesCount: number;
  viewsCount: number;
  bookmarksCount?: number;
  quotesCount?: number;
  author: {
    id: string;
    name: string;
    handle: string;
    image: string | null;
    oabVerified: boolean;
    verificationType: string;
  };
  viewer: {
    liked: boolean;
    reposted: boolean;
    bookmarked?: boolean;
    isAuthor: boolean;
  };
  media?: { id: string; url: string; type: string }[];
  isConfidential?: boolean;
  community?: { slug: string; name: string } | null;
  poll?: {
    options: { id: string; label: string; votes: number }[];
    endsAt: string | null;
  } | null;
  viewerPollOptionId?: string | null;
  court?: { code: string; name: string } | null;
  juris?: JurisFeedCardData | null;
  linkPreview?: {
    url: string;
    title: string | null;
    description: string | null;
    image: string | null;
    siteName: string | null;
  } | null;
  thread?: { threadId: string; partCount: number } | null;
  repostedBy?: { name: string; handle: string } | null;
  viewerLastReply?: {
    id: string;
    content: string;
    createdAt: Date;
    media: { url: string; type: string }[];
  } | null;
};

type Props = {
  item: PublicationItem;
  onUpdate: (patch: Partial<PublicationItem>) => void;
  /** Registra view ao entrar no viewport (feed). Na página de detalhe use registerViewOnMount. */
  trackViewInFeed?: boolean;
  registerViewOnMount?: boolean;
  /** Evita query `me` duplicada em cada card do feed. */
  me?: { displayName: string; image: string | null } | null;
};

export function PublicationCard({
  item,
  onUpdate,
  trackViewInFeed = false,
  registerViewOnMount = false,
  me: meProp,
}: Props) {
  const utils = trpc.useUtils();
  const meQuery = trpc.redeTeste.me.useQuery(undefined, { enabled: meProp === undefined });
  const meData = meProp ?? meQuery.data;
  const myLastReply = item.viewerLastReply ?? null;
  const [replyOpen, setReplyOpen] = useState(false);
  const [content, setContent] = useState(item.content);
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useRegisterPublicationView(item.id, {
    enabled: trackViewInFeed || registerViewOnMount,
    observe: trackViewInFeed,
  });

  const like = trpc.redeTeste.toggleLike.useMutation({
    onMutate: async () => {
      const liked = !item.viewer.liked;
      onUpdate({
        viewer: { ...item.viewer, liked },
        likesCount: item.likesCount + (liked ? 1 : -1),
      });
    },
    onError: (e) => {
      toast.error(e.message);
      void utils.juridiques.feed.invalidate();
    },
  });

  const bookmark = trpc.redeTeste.toggleBookmark.useMutation({
    onMutate: async () => {
      const bookmarked = !item.viewer.bookmarked;
      onUpdate({
        viewer: { ...item.viewer, bookmarked },
        bookmarksCount: (item.bookmarksCount ?? 0) + (bookmarked ? 1 : -1),
      });
    },
    onSuccess: () => {
      void utils.juridiques.listBookmarks.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
      void utils.juridiques.feed.invalidate();
    },
  });

  const repost = trpc.redeTeste.toggleRepost.useMutation({
    onMutate: async () => {
      const reposted = !item.viewer.reposted;
      onUpdate({
        viewer: { ...item.viewer, reposted },
        repostsCount: item.repostsCount + (reposted ? 1 : -1),
      });
    },
    onSuccess: () => {
      void utils.juridiques.userPublications.invalidate();
      toast.success(item.viewer.reposted ? "Republicação removida" : "Republicado");
    },
    onError: () => void utils.juridiques.feed.invalidate(),
  });

  const long = content.length > 280;
  const preview = long ? `${content.slice(0, 280)}…` : content;

  const youTubeId =
    parseYouTubeId(item.linkPreview?.url) ?? findYouTubeIdInText(content);

  const replyUser = {
    name: meData?.displayName ?? "Você",
    image: meData?.image ?? null,
  };

  async function handleShare() {
    const url = `${window.location.origin}/rede-teste/publicacao/${item.id}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: `${item.author.name} no Rede Teste`,
          url,
        });
        return;
      }
    } catch {
      /* cancelado ou indisponível */
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  return (
    <article
      id={`jq-pub-${item.id}`}
      className="border-b border-[var(--jq-border)] px-4 py-3 transition hover:bg-[var(--jq-surface)]/40"
      aria-label={`Publicação de ${item.author.name}`}
    >
      {item.repostedBy ? (
        <Link
          href={jqProfilePath(item.repostedBy.handle)}
          className="mb-1 ml-10 flex items-center gap-1.5 text-xs font-semibold text-[var(--jq-muted)] hover:underline"
        >
          <Repeat2 className="size-4" /> {item.repostedBy.name} republicou
        </Link>
      ) : null}
      <div className="flex gap-3">
        <Link href={jqProfilePath(item.author.handle)}>
          <JqAvatar src={item.author.image} name={item.author.name} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1 text-sm">
                <Link
                  href={jqProfilePath(item.author.handle)}
                  className="truncate font-bold hover:underline"
                >
                  {item.author.name}
                </Link>
                <JqVerifiedBadge
                  type={item.author.oabVerified ? "LAWYER" : item.author.verificationType}
                  showOabBeta={
                    showJqOabBetaBadge() &&
                    (item.author.oabVerified || item.author.verificationType === "LAWYER")
                  }
                />
                <span className="truncate text-[var(--jq-muted)]">
                  {formatJqHandle(item.author.handle)}
                </span>
                <span className="text-[var(--jq-muted)]">·</span>
                <time
                  className="text-[var(--jq-muted)] hover:underline"
                  dateTime={new Date(item.createdAt).toISOString()}
                  title={new Date(item.createdAt).toLocaleString("pt-BR")}
                >
                  {formatJqRelativeTime(item.createdAt)}
                </time>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {item.practiceArea ? <PracticeAreaTag area={item.practiceArea} /> : null}
                {item.isConfidential ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <Lock className="size-3" />
                    Sigilo profissional
                  </span>
                ) : null}
                {item.court ? (
                  <Link
                    href={`/rede-teste/explorar?court=${encodeURIComponent(item.court.code)}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--jq-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--jq-primary)] hover:underline"
                  >
                    ⚖️ {item.court.code}
                  </Link>
                ) : null}
                {item.community ? (
                  <Link
                    href={`/rede-teste/comunidades/${item.community.slug}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--jq-surface)] px-2 py-0.5 text-xs text-[var(--jq-muted)] hover:text-[var(--jq-primary)]"
                  >
                    <Layers className="size-3" />
                    {item.community.name}
                  </Link>
                ) : null}
              </div>
            </div>
            <PublicationMoreMenu
              publicationId={item.id}
              authorId={item.author.id}
              isAuthor={item.viewer.isAuthor}
              initialContent={content}
              onUpdated={(next) => {
                setContent(next);
                onUpdate({ content: next });
              }}
              onDeleted={() => onUpdate({})}
            />
          </div>

          <div className="mt-1 break-words">
            <Link href={`/rede-teste/publicacao/${item.id}`} className="block">
              <span className="whitespace-pre-wrap">
                <RichTextContent text={expanded ? content : preview} />
              </span>
            </Link>
            {long ? (
              <button
                type="button"
                className="text-[var(--jq-reply)] hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
              >
                {expanded ? "Ver menos" : "Ver mais"}
              </button>
            ) : null}
          </div>

          {item.juris ? <JurisFeedCard juris={item.juris} /> : null}

          {item.media?.length ? (
            <PublicationMedia
              media={item.media}
              onOpen={(index) => setLightboxIndex(index)}
            />
          ) : null}

          {youTubeId ? (
            <YouTubeEmbed
              id={youTubeId}
              title={item.linkPreview?.title}
              description={item.linkPreview?.description}
            />
          ) : item.linkPreview ? (
            <PublicationLinkPreview preview={item.linkPreview} />
          ) : null}

          {item.thread ? (
            <Link
              href={`/rede-teste/publicacao/${item.id}`}
              className="mt-2 inline-flex text-sm text-[var(--jq-reply)] hover:underline"
            >
              🧵 Thread ({item.thread.partCount} publicações)
            </Link>
          ) : null}

          {item.poll ? (
            <PublicationPoll
              publicationId={item.id}
              poll={item.poll as JqPollStored}
              viewerOptionId={item.viewerPollOptionId ?? null}
              onVote={(optionId, poll) =>
                onUpdate({ viewerPollOptionId: optionId, poll })
              }
            />
          ) : null}

          <div className="mt-3 flex max-w-md justify-between text-[var(--jq-muted)]">
            <ActionBtn
              icon={MessageCircle}
              count={item.repliesCount}
              label="Responder"
              hoverClass="hover:text-[var(--jq-reply)] hover:bg-[var(--jq-reply)]/10"
              onClick={() => setReplyOpen((v) => !v)}
            />
            <ActionBtn
              icon={Repeat2}
              count={item.repostsCount}
              label="Republicar"
              active={item.viewer.reposted}
              hoverClass="hover:text-[var(--jq-repost)] hover:bg-[var(--jq-repost)]/10"
              onClick={() => repost.mutate({ publicationId: item.id })}
              activeClass={item.viewer.reposted ? "text-[var(--jq-repost)]" : ""}
            />
            <ActionBtn
              icon={Heart}
              count={item.likesCount}
              label="Curtir"
              active={item.viewer.liked}
              hoverClass="hover:text-[var(--jq-like)] hover:bg-[var(--jq-like)]/10"
              onClick={() => like.mutate({ publicationId: item.id })}
              activeClass={item.viewer.liked ? "text-[var(--jq-like)] fill-[var(--jq-like)]" : ""}
            />
            <ActionBtn
              icon={BarChart2}
              count={item.viewsCount}
              label="Visualizações"
              hoverClass="hover:text-[var(--jq-muted)]"
            />
            <ActionBtn
              icon={Bookmark}
              count={item.bookmarksCount}
              label={item.viewer.bookmarked ? "Remover dos salvos" : "Arquivar"}
              active={item.viewer.bookmarked}
              hoverClass="hover:text-[var(--jq-accent)] hover:bg-[var(--jq-accent)]/10"
              activeClass={item.viewer.bookmarked ? "text-[var(--jq-accent)] fill-[var(--jq-accent)]" : ""}
              onClick={() => bookmark.mutate({ publicationId: item.id })}
            />
            <ActionBtn
              icon={Share2}
              label="Compartilhar"
              hoverClass="hover:text-[var(--jq-reply)] hover:bg-[var(--jq-reply)]/10"
              onClick={() => void handleShare()}
            />
          </div>

          {myLastReply ? (
            <Link
              href={`/rede-teste/publicacao/${item.id}`}
              className="mt-2 flex gap-2 rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)]/50 px-3 py-2 transition hover:bg-[var(--jq-surface)]"
            >
              <JqAvatar src={replyUser.image} name={replyUser.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--jq-muted)]">
                  Seu comentário ·{" "}
                  {formatJqRelativeTime(myLastReply.createdAt)}
                </p>
                {myLastReply.content?.trim() ? (
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words text-sm">
                    {myLastReply.content}
                  </p>
                ) : null}
                {myLastReply.media?.length ? (
                  <p className="mt-0.5 text-xs text-[var(--jq-muted)]">
                    {myLastReply.media[0]!.type === "GIF" ? "GIF" : "Mídia anexada"}
                  </p>
                ) : null}
              </div>
            </Link>
          ) : null}

          {replyOpen ? (
            <div className="mt-3 border-t border-[var(--jq-border)] pt-2">
              <PublicationComposer
                user={replyUser}
                parentId={item.id}
                parentAllowGifReplies={item.allowGifReplies}
                placeholder="Escreva um comentário…"
                onPublished={() => {
                  setReplyOpen(false);
                  onUpdate({ repliesCount: item.repliesCount + 1 });
                  void utils.juridiques.replies.invalidate({ parentId: item.id });
                  void utils.juridiques.feed.invalidate();
                }}
              />
              <Link
                href={`/rede-teste/publicacao/${item.id}`}
                className="mt-2 inline-block text-xs text-[var(--jq-reply)] hover:underline"
              >
                Ver conversa completa
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {item.media?.length && lightboxIndex != null ? (
        <JqMediaLightbox
          open
          items={item.media}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </article>
  );
}

function ActionBtn({
  icon: Icon,
  count,
  label,
  hoverClass,
  activeClass,
  active,
  onClick,
  href,
}: {
  icon: typeof Heart;
  count?: number;
  label: string;
  hoverClass: string;
  activeClass?: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <Icon className={cn("size-[18px]", active && activeClass)} />
      {count != null && count > 0 ? (
        <span className="text-xs tabular-nums">{formatCount(count)}</span>
      ) : null}
    </>
  );
  const className = cn(
    "group flex items-center gap-1 rounded-full p-2 transition",
    hoverClass,
    activeClass,
  );

  if (href) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" className={className} aria-label={label} onClick={onClick}>
      {inner}
    </button>
  );
}

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
