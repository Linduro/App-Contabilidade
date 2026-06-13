"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PublicationList } from "../feed/publication-list";
import { ArrowLeft, Search } from "lucide-react";
import { pluralize } from "@/lib/i18n/plural";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import { JqFollowButton } from "../shared/follow-button";
import { JqAvatar } from "../shared/jq-avatar";
import { formatJqHandle } from "@/lib/rede-teste/format";
import {
  pushSearchHistory,
} from "@/lib/rede-teste/search-history";
import { JqQueryState } from "../shared/jq-query-state";
import { ExploreForYouFeed } from "./explore-for-you-feed";
import { ExploreHojeNoDireito } from "./explore-hoje-no-direito";

type ExploreTab = "top" | "people" | "hashtags" | "for-you" | "hoje-no-direito";

function inferSearchType(q: string): ExploreTab {
  if (q.startsWith("#")) return "hashtags";
  if (q.startsWith("@")) return "people";
  return "top";
}

function parseExploreTab(raw: string | null): ExploreTab {
  if (
    raw === "people" ||
    raw === "hashtags" ||
    raw === "for-you" ||
    raw === "hoje-no-direito" ||
    raw === "top"
  )
    return raw;
  return "for-you";
}

export function ExploreView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const initialCourt = searchParams.get("court") ?? "";
  const typeParam = searchParams.get("type");
  const initialType: ExploreTab = typeParam
    ? parseExploreTab(typeParam)
    : initialQ
      ? inferSearchType(initialQ)
      : "for-you";

  const [q, setQ] = useState(initialQ || initialCourt);
  const [type, setType] = useState<ExploreTab>(initialType);
  const [submitted, setSubmitted] = useState(
    initialQ.length > 0 ||
      initialCourt.length > 0 ||
      initialType === "for-you" ||
      initialType === "hoje-no-direito",
  );
  const courtFilter = searchParams.get("court") ?? undefined;

  useEffect(() => {
    const urlQ = searchParams.get("q") ?? "";
    const urlCourt = searchParams.get("court") ?? "";
    const urlType = searchParams.get("type");
    const parsedType = urlType ? parseExploreTab(urlType) : urlQ ? inferSearchType(urlQ) : "for-you";
    setQ(urlQ || urlCourt);
    setType(parsedType);
    setSubmitted(
      urlQ.length > 0 ||
        urlCourt.length > 0 ||
        parsedType === "for-you" ||
        parsedType === "hoje-no-direito",
    );
  }, [searchParams]);

  const query = submitted ? q.trim() : "";
  const effectiveType = query
    ? inferSearchType(query) === "people"
      ? "people"
      : type
    : type;

  useEffect(() => {
    if (query.startsWith("@") || query.startsWith("#")) {
      setType(inferSearchType(query));
    }
  }, [query]);

  const trends = trpc.redeTeste.trendingHashtags.useQuery(undefined, {
    enabled:
      !submitted && type !== "people" && type !== "for-you" && type !== "hoje-no-direito",
  });
  const peopleSuggest = trpc.redeTeste.suggestions.useQuery(undefined, {
    enabled: !submitted && type === "people",
  });
  const suggestNotFollowing = (peopleSuggest.data ?? []).filter((s) => !s.following);

  const searchTerm = query.replace(/^[@#]/, "");
  const search = trpc.redeTeste.search.useQuery(
    {
      q: courtFilter && !searchTerm ? "" : searchTerm,
      type: effectiveType === "people" ? "people" : effectiveType === "hashtags" ? "hashtags" : "top",
      limit: 20,
      court: courtFilter,
    },
    { enabled: query.length > 0 || !!courtFilter },
  );

  function runSearch() {
    if (!q.trim()) return;
    const trimmed = q.trim();
    const nextType = inferSearchType(trimmed);
    setType(nextType === "top" ? type : nextType);
    setSubmitted(true);
    pushSearchHistory(trimmed);
    router.push(
      `/rede-teste/explorar?q=${encodeURIComponent(trimmed)}&type=${encodeURIComponent(
        nextType === "top" ? type : nextType,
      )}`,
    );
  }

  const people = search.data?.people ?? [];
  const hashtags = search.data?.hashtags ?? [];
  const pubs = search.data?.publications ?? [];

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/rede-teste" className="rounded-full p-2 hover:bg-[var(--jq-surface)]" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Link>
          <h1 className="text-lg font-bold">Explorar</h1>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--jq-muted)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Buscar @pessoa, #hashtag ou texto"
              className="rounded-full pl-10"
              aria-label="Buscar @pessoa, #hashtag ou texto"
            />
          </div>
          <Button type="button" className="rounded-full" onClick={runSearch}>
            Buscar
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["for-you", "hoje-no-direito", "people", "hashtags"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                type === t
                  ? "bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
                  : "bg-[var(--jq-surface)] text-[var(--jq-muted)]"
              }`}
              onClick={() => {
                setType(t);
                if (t === "for-you" || t === "hoje-no-direito") {
                  setSubmitted(true);
                  router.push(`/rede-teste/explorar?type=${t}`);
                } else {
                  setSubmitted(false);
                  router.push(`/rede-teste/explorar?type=${t}`);
                }
              }}
            >
              {t === "for-you"
                ? "Para você"
                : t === "hoje-no-direito"
                  ? "Hoje no Direito"
                  : t === "people"
                    ? "Pessoas"
                    : "Hashtags"}
            </button>
          ))}
        </div>
      </header>

      {type === "hoje-no-direito" ? (
        <ExploreHojeNoDireito />
      ) : type === "for-you" && submitted ? (
        <ExploreForYouFeed />
      ) : !submitted ? (
        type === "people" ? (
          <JqQueryState
            isLoading={peopleSuggest.isLoading}
            isError={peopleSuggest.isError}
            error={peopleSuggest.error}
            onRetry={() => void peopleSuggest.refetch()}
            errorFallback="Não foi possível carregar perfis."
          >
            <section className="p-4">
              <h2 className="text-sm font-bold text-[var(--jq-muted)]">
                Possíveis litisconsortes para você
              </h2>
              <p className="mt-0.5 text-xs text-[var(--jq-muted)]">
                Pessoas que você ainda não segue e que combinam com sua atuação.
              </p>
              <ul className="mt-2 divide-y divide-[var(--jq-border)] rounded-lg border border-[var(--jq-border)]">
                {suggestNotFollowing.map((p) => (
                  <li key={p.userId} className="flex items-center gap-2 px-4 py-3">
                    <Link
                      href={jqProfilePath(p.handle)}
                      className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90"
                    >
                      <JqAvatar src={p.image} name={p.displayName} size="md" />
                      <div className="min-w-0">
                        <p className="truncate font-bold">{p.displayName}</p>
                        <p className="truncate text-sm text-[var(--jq-muted)]">
                          {formatJqHandle(p.handle)}
                        </p>
                        {p.reason ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--jq-reply)]">
                            {p.reason}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                    <JqFollowButton userId={p.userId} following={p.following} />
                  </li>
                ))}
                {!suggestNotFollowing.length && !peopleSuggest.isLoading ? (
                  <li className="px-4 py-6 text-center text-sm text-[var(--jq-muted)]">
                    Nenhuma sugestão no momento. Interaja com publicações para melhorar as recomendações.
                  </li>
                ) : null}
              </ul>
            </section>
          </JqQueryState>
        ) : (
          <JqQueryState
            isLoading={trends.isLoading}
            isError={trends.isError}
            error={trends.error}
            onRetry={() => void trends.refetch()}
            errorFallback="Não foi possível carregar a busca."
          >
            <section className="p-4">
              <h2 className="text-sm font-bold text-[var(--jq-muted)]">Em pauta</h2>
              <ul className="mt-2">
                {trends.data?.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      className="w-full py-3 text-left hover:bg-[var(--jq-surface)]"
                      onClick={() => {
                        setQ(`#${h.tag}`);
                        setType("hashtags");
                        setSubmitted(true);
                      }}
                    >
                      <span className="font-bold">#{h.tag}</span>
                      <span className="ml-2 text-sm text-[var(--jq-muted)]">
                        {h.publicationsCount}{" "}
                        {pluralize(h.publicationsCount, "publicação", "publicações")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </JqQueryState>
        )
      ) : type !== "for-you" ? (
        <JqQueryState
          isLoading={search.isLoading}
          isError={search.isError}
          error={search.error}
          onRetry={() => void search.refetch()}
          errorFallback="Não foi possível carregar os resultados da busca."
        >
          {effectiveType === "people" || query.startsWith("@") ? (
            <ul>
              {people.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center gap-2 border-b border-[var(--jq-border)] px-4 py-3"
                >
                  <Link
                    href={jqProfilePath(p.handle)}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <JqAvatar src={p.image} name={p.displayName} size="md" />
                    <div>
                      <p className="font-bold">{p.displayName}</p>
                      <p className="text-sm text-[var(--jq-muted)]">{formatJqHandle(p.handle)}</p>
                    </div>
                  </Link>
                  <JqFollowButton userId={p.userId} following={p.viewerFollowing ?? false} />
                </li>
              ))}
              {!people.length ? (
                <p className="p-8 text-center text-sm text-[var(--jq-muted)]">
                  Nenhum perfil encontrado. Tente o nome ou @handle.
                </p>
              ) : null}
            </ul>
          ) : effectiveType === "hashtags" ? (
            <ul>
              {hashtags.map((h) => (
                <li key={h.id} className="border-b border-[var(--jq-border)] px-4 py-3">
                  <Link
                    href={`/rede-teste/explorar?q=${encodeURIComponent(`#${h.tag}`)}&type=top`}
                    className="font-bold text-[var(--jq-reply)]"
                  >
                    #{h.tag}
                  </Link>
                  <span className="ml-2 text-sm text-[var(--jq-muted)]">
                    {h.publicationsCount}{" "}
                    {pluralize(h.publicationsCount, "publicação", "publicações")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <PublicationList items={pubs} emptyMessage="Nenhuma publicação encontrada." />
          )}
        </JqQueryState>
      ) : null}
    </div>
  );
}
