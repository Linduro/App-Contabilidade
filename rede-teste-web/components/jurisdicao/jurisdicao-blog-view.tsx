"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Loader2, LayoutDashboard, Settings } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { JurisdicaoComposer } from "./jurisdicao-composer";
import { JurisdicaoPostCard } from "./jurisdicao-post-card";
import { JurisdicaoCustomizeDialog } from "./jurisdicao-customize-dialog";
import { JurisdicaoRadio } from "./jurisdicao-radio";
import { type JrdPost, jrdFontStack } from "./jurisdicao-utils";

export function JurisdicaoBlogView({ handle }: { handle: string }) {
  const blogQ = trpc.jurisdicao.getBlogByHandle.useQuery({ handle });
  const [items, setItems] = useState<JrdPost[]>([]);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [following, setFollowing] = useState(false);

  const posts = trpc.jurisdicao.listPosts.useInfiniteQuery(
    { handle, limit: 15 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );

  useEffect(() => {
    if (blogQ.data) setFollowing(blogQ.data.isFollowing);
  }, [blogQ.data]);

  useEffect(() => {
    if (!posts.data) return;
    setItems(posts.data.pages.flatMap((p) => p.posts as unknown as JrdPost[]));
  }, [posts.data]);

  const follow = trpc.jurisdicao.toggleFollow.useMutation({
    onSuccess: (r) => {
      setFollowing(r.following);
      toast.success(r.following ? "Seguindo esta Jurisdição" : "Deixou de seguir");
    },
    onError: (e) => toast.error(e.message),
  });

  const prepend = useCallback((post: JrdPost) => setItems((prev) => [post, ...prev]), []);
  const removeItem = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), []);

  if (blogQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-900">
        <Loader2 className="size-6 animate-spin text-white/70" />
      </div>
    );
  }
  if (blogQ.isError || !blogQ.data) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-900 px-4 text-center text-white/80">
        <div>
          <p className="text-lg font-bold">Jurisdição não encontrada</p>
          <Link href="/jurisdicao" className="mt-2 inline-block text-sky-300 hover:underline">
            Ir para a minha Jurisdição
          </Link>
        </div>
      </div>
    );
  }

  const blog = blogQ.data;
  const rootStyle: CSSProperties = {
    background: blog.bgColor,
    color: blog.textColor,
    fontFamily: jrdFontStack(blog.fontFamily),
    ...(blog.bgImageUrl
      ? { backgroundImage: `url(${blog.bgImageUrl})`, backgroundAttachment: "fixed" }
      : {}),
  };

  return (
    <div className="min-h-screen" style={rootStyle}>
      {blog.headerUrl ? (
        <div
          className="h-44 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${blog.headerUrl})` }}
        />
      ) : null}

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 lg:flex-row">
        <aside className="space-y-4 lg:sticky lg:top-8 lg:h-fit lg:w-[300px]">
          {blog.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={blog.avatarUrl}
              alt=""
              className="size-24 rounded-[4px] border-4 border-white/20 object-cover"
            />
          ) : null}
          <h1 className="text-3xl font-bold leading-tight">{blog.title}</h1>
          {blog.description ? (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed opacity-90">
              {blog.description}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {blog.isOwner ? (
              <>
                <Link
                  href="/jurisdicao"
                  className="inline-flex items-center gap-1 rounded-[3px] px-3 py-1.5 text-sm font-bold"
                  style={{ background: blog.accentColor, color: "#fff" }}
                >
                  <LayoutDashboard className="size-4" />
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => setCustomizeOpen(true)}
                  className="inline-flex items-center gap-1 rounded-[3px] border border-current px-3 py-1.5 text-sm font-bold opacity-90"
                >
                  <Settings className="size-4" />
                  Personalizar
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={follow.isPending}
                onClick={() => follow.mutate({ blogId: blog.id })}
                className="inline-flex items-center gap-1 rounded-[3px] px-4 py-1.5 text-sm font-bold"
                style={
                  following
                    ? { border: "1px solid currentColor" }
                    : { background: blog.accentColor, color: "#fff" }
                }
              >
                {following ? "Seguindo" : "Seguir"}
              </button>
            )}
          </div>
          <p className="text-xs opacity-70">
            {blog.followersCount} {blog.followersCount === 1 ? "seguidor" : "seguidores"}
          </p>
        </aside>

        <main className="w-full max-w-[560px] space-y-5">
          {blog.isOwner ? (
            <JurisdicaoComposer accent={blog.accentColor} onCreated={prepend} />
          ) : null}

          {posts.isLoading ? (
            <p className="flex items-center justify-center gap-2 py-10 opacity-80">
              <Loader2 className="size-5 animate-spin" /> Carregando…
            </p>
          ) : items.length === 0 ? (
            <div className="rounded-[3px] bg-white/90 p-8 text-center text-neutral-700">
              Nenhum post ainda.
            </div>
          ) : (
            <>
              {items.map((post) => (
                <JurisdicaoPostCard
                  key={post.id}
                  post={post}
                  accent={blog.accentColor}
                  canDelete={blog.isOwner}
                  onDeleted={removeItem}
                />
              ))}
              {posts.hasNextPage ? (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    onClick={() => void posts.fetchNextPage()}
                    disabled={posts.isFetchingNextPage}
                    className="rounded-[3px] bg-white/90 px-4 py-2 text-sm font-semibold text-neutral-800"
                  >
                    {posts.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>

      {blog.radioUrl ? (
        <JurisdicaoRadio
          url={blog.radioUrl}
          label={blog.radioLabel}
          autoplay={blog.radioAutoplay}
        />
      ) : null}

      {blog.isOwner ? (
        <JurisdicaoCustomizeDialog
          blog={blog}
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
          onSaved={() => void blogQ.refetch()}
        />
      ) : null}
    </div>
  );
}
