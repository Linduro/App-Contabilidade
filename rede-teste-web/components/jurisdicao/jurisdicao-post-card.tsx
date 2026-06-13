"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Repeat2, Trash2, Link2, Send } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { type JrdPost, jrdVideoEmbed } from "./jurisdicao-utils";

type Props = {
  post: JrdPost;
  accent: string;
  /** Mostra avatar/nome do blog (usado no dashboard com posts de vários blogs). */
  showBlog?: boolean;
  /** Permite excluir (dono do post). */
  canDelete?: boolean;
  onDeleted?: (id: string) => void;
  onReblogged?: () => void;
};

export function JurisdicaoPostCard({
  post,
  accent,
  showBlog,
  canDelete,
  onDeleted,
  onReblogged,
}: Props) {
  const [liked, setLiked] = useState(post.viewerLiked);
  const [likes, setLikes] = useState(post.likesCount);
  const [reblogs, setReblogs] = useState(post.reblogsCount);

  const like = trpc.jurisdicao.toggleLike.useMutation({
    onSuccess: (r) => {
      setLiked(r.liked);
      setLikes((n) => (r.liked ? n + 1 : Math.max(0, n - 1)));
    },
    onError: (e) => toast.error(e.message),
  });
  const reblog = trpc.jurisdicao.reblog.useMutation({
    onSuccess: () => {
      setReblogs((n) => n + 1);
      toast.success("Reblogado para a sua Jurisdição");
      onReblogged?.();
    },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.jurisdicao.deletePost.useMutation({
    onSuccess: () => {
      toast.success("Post excluído");
      onDeleted?.(post.id);
    },
    onError: (e) => toast.error(e.message),
  });
  const share = trpc.jurisdicao.shareToJuridiques.useMutation({
    onSuccess: () => toast.success("Compartilhado no seu feed do Juridiquês"),
    onError: (e) => toast.error(e.message),
  });

  const notes = likes + reblogs;
  const permalink = `/jurisdicao/${post.blog.handle}/post/${post.id}`;
  const embed = post.type === "VIDEO" && post.videoUrl ? jrdVideoEmbed(post.videoUrl) : null;

  return (
    <article className="overflow-hidden rounded-[3px] border border-black/10 bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]">
      {showBlog ? (
        <div className="flex items-center gap-2 border-b border-black/5 px-4 py-2">
          {post.blog.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.blog.avatarUrl} alt="" className="size-6 rounded-[3px] object-cover" />
          ) : (
            <span className="grid size-6 place-items-center rounded-[3px] bg-neutral-200 text-[10px] font-bold">
              {post.blog.title.slice(0, 2).toUpperCase()}
            </span>
          )}
          <Link href={`/jurisdicao/${post.blog.handle}`} className="text-sm font-bold hover:underline">
            {post.blog.title}
          </Link>
        </div>
      ) : null}

      {post.rebloggedFromHandle ? (
        <p className="px-4 pt-3 text-xs text-neutral-500">
          <Repeat2 className="mr-1 inline size-3" />
          reblogado de{" "}
          <Link href={`/jurisdicao/${post.rebloggedFromHandle}`} className="font-semibold hover:underline">
            {post.rebloggedFromTitle ?? post.rebloggedFromHandle}
          </Link>
        </p>
      ) : null}

      <div className="px-4 py-4">{renderBody(post, accent, embed)}</div>

      {post.tags.length ? (
        <div className="flex flex-wrap gap-x-2 gap-y-1 px-4 pb-3 text-xs text-neutral-500">
          {post.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      ) : null}

      <footer className="flex items-center gap-3 border-t border-black/5 px-4 py-2 text-xs text-neutral-500">
        <Link href={permalink} className="hover:underline">
          {format(new Date(post.createdAt), "dd MMM yyyy, HH:mm", { locale: ptBR })}
        </Link>
        {notes > 0 ? <span>· {notes} notas</span> : null}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="flex items-center gap-1 rounded p-1 hover:bg-black/5"
            aria-label="Reblogar"
            title="Reblogar"
            disabled={reblog.isPending}
            onClick={() => reblog.mutate({ postId: post.id })}
          >
            <Repeat2 className="size-4" />
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded p-1 hover:bg-black/5"
            aria-label="Curtir"
            title="Curtir"
            disabled={like.isPending}
            onClick={() => like.mutate({ postId: post.id })}
            style={liked ? { color: "#e0245e" } : undefined}
          >
            <Heart className="size-4" fill={liked ? "#e0245e" : "none"} />
          </button>
          {canDelete ? (
            <button
              type="button"
              className="rounded p-1 hover:bg-black/5"
              aria-label="Compartilhar no Juridiquês"
              title="Compartilhar no meu feed do Juridiquês"
              disabled={share.isPending}
              onClick={() => share.mutate({ postId: post.id })}
            >
              <Send className="size-4" />
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="rounded p-1 hover:bg-black/5"
              aria-label="Excluir post"
              title="Excluir"
              disabled={del.isPending}
              onClick={() => {
                if (confirm("Excluir este post?")) del.mutate({ id: post.id });
              }}
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
        </div>
      </footer>
    </article>
  );
}

function renderBody(post: JrdPost, accent: string, embed: string | null) {
  switch (post.type) {
    case "PHOTO": {
      const photos =
        post.imageUrls && post.imageUrls.length
          ? post.imageUrls
          : post.imageUrl
            ? [post.imageUrl]
            : [];
      return (
        <div className="space-y-3">
          {photos.length === 1 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photos[0]}
              alt={post.title ?? ""}
              className="-mx-4 -mt-4 w-[calc(100%+2rem)] max-w-none"
            />
          ) : photos.length > 1 ? (
            <div
              className={`-mx-4 -mt-4 grid w-[calc(100%+2rem)] gap-1 ${
                photos.length === 2 ? "grid-cols-2" : "grid-cols-3"
              }`}
            >
              {photos.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt="" className="h-full w-full object-cover" />
              ))}
            </div>
          ) : null}
          {post.body ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{post.body}</p>
          ) : null}
        </div>
      );
    }
    case "AUDIO":
      return (
        <div className="space-y-3">
          {post.title ? <h2 className="text-lg font-bold">{post.title}</h2> : null}
          {post.audioUrl ? (
            <audio src={post.audioUrl} controls className="w-full" />
          ) : null}
          {post.body ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{post.body}</p>
          ) : null}
        </div>
      );
    case "QUOTE":
      return (
        <figure>
          <blockquote
            className="border-l-4 pl-4 text-2xl font-semibold leading-snug"
            style={{ borderColor: accent }}
          >
            “{post.body}”
          </blockquote>
          {post.quoteSource ? (
            <figcaption className="mt-2 text-sm text-neutral-500">— {post.quoteSource}</figcaption>
          ) : null}
        </figure>
      );
    case "LINK":
      return (
        <div className="space-y-2">
          <a
            href={post.linkUrl ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xl font-bold hover:underline"
            style={{ color: accent }}
          >
            <Link2 className="size-5 shrink-0" />
            {post.title || post.linkUrl}
          </a>
          {post.body ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-700">
              {post.body}
            </p>
          ) : null}
        </div>
      );
    case "CHAT":
      return (
        <div className="space-y-2">
          {post.title ? <h2 className="text-lg font-bold">{post.title}</h2> : null}
          <div className="divide-y divide-black/5 rounded-[3px] bg-neutral-50">
            {(post.body ?? "").split("\n").filter(Boolean).map((line, i) => {
              const idx = line.indexOf(":");
              const name = idx > 0 ? line.slice(0, idx) : null;
              const msg = idx > 0 ? line.slice(idx + 1).trim() : line;
              return (
                <p key={i} className="px-3 py-1.5 text-[15px]">
                  {name ? (
                    <span className="font-bold" style={{ color: accent }}>
                      {name}:{" "}
                    </span>
                  ) : null}
                  {msg}
                </p>
              );
            })}
          </div>
        </div>
      );
    case "VIDEO":
      return (
        <div className="space-y-3">
          {embed ? (
            <div className="-mx-4 -mt-4 aspect-video w-[calc(100%+2rem)]">
              <iframe
                src={embed}
                className="size-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={post.title ?? "Vídeo"}
              />
            </div>
          ) : post.videoUrl ? (
            <a
              href={post.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 font-bold hover:underline"
              style={{ color: accent }}
            >
              <Link2 className="size-5" />
              Assistir ao vídeo
            </a>
          ) : null}
          {post.body ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{post.body}</p>
          ) : null}
        </div>
      );
    case "TEXT":
    default:
      return (
        <div className="space-y-2">
          {post.title ? (
            <h2 className="text-2xl font-bold leading-tight">{post.title}</h2>
          ) : null}
          {post.body ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{post.body}</p>
          ) : null}
        </div>
      );
  }
}
