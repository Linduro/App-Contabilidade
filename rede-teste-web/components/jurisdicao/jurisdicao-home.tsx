"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, NotebookPen, Settings, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { JurisdicaoComposer } from "./jurisdicao-composer";
import { JurisdicaoPostCard } from "./jurisdicao-post-card";
import { JurisdicaoCustomizeDialog } from "./jurisdicao-customize-dialog";
import { type JrdPost } from "./jurisdicao-utils";

const BAR = "#2c4762";

export function JurisdicaoHome() {
  const utils = trpc.useUtils();
  const myBlog = trpc.jurisdicao.myBlog.useQuery();

  if (myBlog.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-950">
        <Loader2 className="size-6 animate-spin text-sky-300" />
      </div>
    );
  }

  if (!myBlog.data) {
    return <CreateBlog onCreated={() => void utils.jurisdicao.myBlog.invalidate()} />;
  }

  return <Dashboard blog={myBlog.data} onChanged={() => void myBlog.refetch()} />;
}

function CreateBlog({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const create = trpc.jurisdicao.createBlog.useMutation({
    onSuccess: () => {
      toast.success("Sua Jurisdição foi criada!");
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="grid min-h-screen place-items-center bg-neutral-950 px-4">
      <div className="w-full max-w-md rounded-md border border-white/10 bg-neutral-900 p-6 text-neutral-100 shadow-xl">
        <h1 className="font-serif text-2xl font-bold text-sky-300">Crie sua Jurisdição</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Seu espaço livre, estilo blog. Poste textos, fotos, photosets, áudios, citações, links,
          chats e vídeos — do seu jeito.
        </p>
        <div className="mt-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome do blog (ex: Diário Forense)"
            className="w-full rounded-md border border-white/15 bg-neutral-800 px-3 py-2 text-[15px] text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/40"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={3}
            className="w-full rounded-md border border-white/15 bg-neutral-800 px-3 py-2 text-[15px] text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/40"
          />
          <button
            type="button"
            disabled={create.isPending || !title.trim()}
            onClick={() => create.mutate({ title: title.trim(), description: description.trim() || undefined })}
            className="w-full rounded-md bg-sky-600 px-4 py-2 font-bold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {create.isPending ? "Criando…" : "Criar Jurisdição"}
          </button>
        </div>
      </div>
    </div>
  );
}

type BlogData = {
  id: string;
  handle: string;
  title: string;
  description: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
  bgColor: string;
  textColor: string;
  accentColor: string;
  bgImageUrl: string | null;
  fontFamily: string;
  radioUrl?: string | null;
  radioLabel?: string | null;
  radioAutoplay?: boolean;
};

function Dashboard({ blog, onChanged }: { blog: BlogData; onChanged: () => void }) {
  const [items, setItems] = useState<JrdPost[]>([]);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const feed = trpc.jurisdicao.dashboard.useInfiniteQuery(
    { limit: 15 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );

  useEffect(() => {
    if (!feed.data) return;
    setItems(feed.data.pages.flatMap((p) => p.posts as unknown as JrdPost[]));
  }, [feed.data]);

  const prepend = useCallback((post: JrdPost) => setItems((prev) => [post, ...prev]), []);
  const removeItem = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), []);

  return (
    <div className="min-h-screen bg-neutral-950 pb-16">
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4 py-2 text-white shadow"
        style={{ background: BAR }}
      >
        <Link href="/rede-teste" className="rounded p-1 hover:bg-white/15" aria-label="Voltar à Rede Teste">
          <ArrowLeft className="size-5" />
        </Link>
        <span className="font-serif text-lg font-bold">Jurisdição</span>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href={`/jurisdicao/${blog.handle}`}
            className="flex items-center gap-1 rounded px-2 py-1 text-sm font-semibold hover:bg-white/15"
          >
            <ExternalLink className="size-4" />
            Meu blog
          </Link>
          <button
            type="button"
            onClick={() => setCustomizeOpen(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-sm font-semibold hover:bg-white/15"
          >
            <Settings className="size-4" />
            Personalizar
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[600px] space-y-5 px-3 py-6">
        <JurisdicaoComposer accent={blog.accentColor} onCreated={prepend} />

        {feed.isLoading ? (
          <p className="flex items-center justify-center gap-2 py-10 text-neutral-400">
            <Loader2 className="size-5 animate-spin" /> Carregando…
          </p>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-neutral-900 p-8 text-center text-neutral-300">
            <NotebookPen className="mx-auto mb-2 size-7 text-sky-300" />
            Sua dashboard está vazia. Publique algo acima ou siga outras Jurisdições.
          </div>
        ) : (
          <>
            {items.map((post) => (
              <JurisdicaoPostCard
                key={post.id}
                post={post}
                accent={blog.accentColor}
                showBlog
                canDelete={post.blog.id === blog.id}
                onDeleted={removeItem}
                onReblogged={() => void feed.refetch()}
              />
            ))}
            {feed.hasNextPage ? (
              <div className="flex justify-center py-4">
                <button
                  type="button"
                  onClick={() => void feed.fetchNextPage()}
                  disabled={feed.isFetchingNextPage}
                  className="rounded-md border border-white/15 bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-100"
                >
                  {feed.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <JurisdicaoCustomizeDialog
        blog={blog}
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        onSaved={onChanged}
      />
    </div>
  );
}
