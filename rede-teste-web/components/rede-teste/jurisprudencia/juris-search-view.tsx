"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Scale, Search } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function JurisSearchView() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const initialTribunal = params.get("tribunal") ?? "";

  const [q, setQ] = useState(initialQ);
  const [tribunal, setTribunal] = useState(initialTribunal);

  const facets = trpc.jurisprudencia.facetTribunais.useQuery();
  const hasQuery = initialQ.length >= 2 || !!initialTribunal;

  const results = trpc.jurisprudencia.search.useQuery({
    q: initialQ,
    tribunal: initialTribunal || undefined,
    page: 1,
    limit: hasQuery ? 25 : 15,
  });
  const hits = results.data?.hits ?? [];

  function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim().length >= 2) sp.set("q", q.trim());
    if (tribunal) sp.set("tribunal", tribunal);
    router.push(`/rede-teste/jurisprudencia?${sp.toString()}`);
  }

  return (
    <div className="min-h-screen pb-8">
      <header className="sticky top-0 z-10 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Scale className="size-5 text-[var(--jq-accent)]" />
          <h1 className="text-lg font-bold">Jurisprudência</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--jq-muted)]">
          Corpus pesquisável do Rede Teste — decisões oficiais e capturas via extensão.
        </p>
        <form onSubmit={runSearch} className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--jq-muted)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar ementa, relator, processo…"
              className="pl-9"
            />
          </div>
          <Button type="submit">Buscar</Button>
        </form>
        {facets.data && facets.data.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setTribunal("");
                router.push("/rede-teste/jurisprudencia");
              }}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                !tribunal
                  ? "bg-[var(--jq-accent)] text-white"
                  : "bg-[var(--jq-surface)] text-[var(--jq-muted)]",
              )}
            >
              Todos
            </button>
            {facets.data.slice(0, 12).map((f) => (
              <button
                key={f.tribunal}
                type="button"
                onClick={() => {
                  setTribunal(f.tribunal);
                  const sp = new URLSearchParams({ tribunal: f.tribunal });
                  if (q.trim().length >= 2) sp.set("q", q.trim());
                  router.push(`/rede-teste/jurisprudencia?${sp}`);
                }}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  tribunal === f.tribunal
                    ? "bg-[var(--jq-accent)] text-white"
                    : "bg-[var(--jq-surface)] text-[var(--jq-muted)]",
                )}
              >
                {f.tribunal} ({f.count})
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="px-4 py-4">
        {results.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-[var(--jq-muted)]" />
          </div>
        ) : hits.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--jq-muted)]">
            {initialQ.length >= 2
              ? "Nenhum julgado encontrado."
              : "Digite ao menos 2 caracteres ou filtre por tribunal."}
          </p>
        ) : (
          <ul className="space-y-3">
            {hits.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/rede-teste/jurisprudencia/${h.slug}`}
                  className="block rounded-xl border border-[var(--jq-border)] p-4 transition hover:bg-[var(--jq-surface)]"
                >
                  <p className="text-xs font-medium uppercase text-[var(--jq-muted)]">
                    {h.tribunal ?? "Tribunal"}
                    {h.tipoDecisao ? ` · ${h.tipoDecisao}` : ""}
                  </p>
                  <p className="mt-1 font-semibold">{h.titulo}</p>
                  {(h.relator || h.dataJulgamento) && (
                    <p className="mt-1 text-xs text-[var(--jq-muted)]">
                      {[h.relator, h.dataJulgamento ? new Date(h.dataJulgamento).toLocaleDateString("pt-BR") : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {h.ementa ? (
                    <p className="mt-2 line-clamp-2 text-sm text-[var(--jq-fg)]/85">{h.ementa}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {results.data ? (
          <p className="mt-4 text-center text-xs text-[var(--jq-muted)]">
            {results.data.total} resultado(s) · motor {results.data.engine}
          </p>
        ) : null}
      </div>
    </div>
  );
}
