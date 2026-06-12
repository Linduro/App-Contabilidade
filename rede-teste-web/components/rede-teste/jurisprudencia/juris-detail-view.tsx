"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, Scale, Share2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Props = { slug: string; openPublish?: boolean };

export function JurisDetailView({ slug, openPublish }: Props) {
  const router = useRouter();
  const doc = trpc.jurisprudencia.getDocument.useQuery({ idOrSlug: slug });
  const [comment, setComment] = useState("");
  const [publishOpen, setPublishOpen] = useState(!!openPublish);

  const publish = trpc.jurisprudencia.publish.useMutation({
    onSuccess: (res) => {
      toast.success("Publicado no feed");
      router.push(`/rede-teste/publicacao/${res.publicationId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (doc.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-[var(--jq-muted)]" />
      </div>
    );
  }

  if (!doc.data) {
    return (
      <div className="px-4 py-12 text-center text-[var(--jq-muted)]">
        Julgado não encontrado.
      </div>
    );
  }

  const d = doc.data;

  async function handleShare() {
    const url = `${window.location.origin}/rede-teste/jurisprudencia/${d.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link href="/rede-teste/jurisprudencia" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <Scale className="size-5 text-[var(--jq-accent)]" />
        <h1 className="truncate text-lg font-bold">{d.tribunal ?? "Jurisprudência"}</h1>
      </header>

      <article className="px-4 py-4">
        <p className="text-xs uppercase tracking-wide text-[var(--jq-muted)]">
          {d.fonte.replace(/_/g, " ")}
          {d.tipoDecisao ? ` · ${d.tipoDecisao}` : ""}
        </p>
        <h2 className="mt-2 text-xl font-bold leading-snug">{d.titulo}</h2>
        <dl className="mt-3 grid gap-1 text-sm text-[var(--jq-muted)]">
          {d.relator ? (
            <div>
              <dt className="inline font-medium">Relator: </dt>
              <dd className="inline">{d.relator}</dd>
            </div>
          ) : null}
          {d.numeroProcesso ? (
            <div>
              <dt className="inline font-medium">Processo: </dt>
              <dd className="inline">{d.numeroProcesso}</dd>
            </div>
          ) : null}
          {d.dataJulgamento ? (
            <div>
              <dt className="inline font-medium">Julgamento: </dt>
              <dd className="inline">
                {new Date(d.dataJulgamento).toLocaleDateString("pt-BR")}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {d.fonteUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={d.fonteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 size-4" />
                Fonte original
              </a>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void handleShare()}>
            <Share2 className="mr-1 size-4" />
            Copiar link
          </Button>
          <Button size="sm" onClick={() => setPublishOpen((v) => !v)}>
            Publicar no feed
          </Button>
        </div>

        {publishOpen ? (
          <div className="mt-4 rounded-xl border border-[var(--jq-border)] p-4">
            <p className="text-sm font-medium">Comentário no feed (opcional)</p>
            <Textarea
              className="mt-2"
              maxLength={560}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Sua análise sobre este julgado…"
            />
            <Button
              className="mt-2"
              disabled={publish.isPending}
              onClick={() =>
                publish.mutate({
                  documentId: d.id,
                  content: comment,
                })
              }
            >
              {publish.isPending ? "Publicando…" : "Publicar"}
            </Button>
          </div>
        ) : null}

        {d.ementa ? (
          <section className="mt-6">
            <h3 className="font-semibold">Ementa</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{d.ementa}</p>
          </section>
        ) : null}
        {d.decisao ? (
          <section className="mt-6">
            <h3 className="font-semibold">Decisão</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{d.decisao}</p>
          </section>
        ) : null}
        {d.teseJuridica ? (
          <section className="mt-6">
            <h3 className="font-semibold">Tese</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{d.teseJuridica}</p>
          </section>
        ) : null}
      </article>
    </div>
  );
}
