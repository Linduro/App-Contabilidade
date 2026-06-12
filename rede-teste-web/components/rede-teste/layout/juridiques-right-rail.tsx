"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { RedeTesteSearchBox } from "./rede-teste-search-box";
import { HojeNoDireito } from "./hoje-no-direito";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc-client";
import { JqAvatar } from "../shared/jq-avatar";
import { JqVerifiedBadge } from "../shared/jq-verified-badge";
import { formatJqHandle } from "@/lib/rede-teste/format";
import { pluralize } from "@/lib/i18n/plural";
import { JqFollowButton } from "../shared/follow-button";
import { useJqScroll } from "../jq-scroll-context";
import { cn } from "@/lib/utils";

const LITIS_DISMISS_DAYS = 7;
const PLAN_DISMISS_KEY = "jq-plan-card-dismissed-date";
const LITIS_DISMISS_KEY = "jq-litis-dismissed";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function RedeTesteRightRail() {
  const { scrolled } = useJqScroll();
  const railRef = useRef<HTMLElement | null>(null);
  const [stickyTop, setStickyTop] = useState("0px");
  const trends = trpc.redeTeste.trendingHashtags.useQuery();
  const suggestions = trpc.redeTeste.suggestions.useQuery();
  const caps = trpc.redeTeste.composerCapabilities.useQuery();
  const isSubscribed = !!caps.data?.plan && caps.data.plan !== "TRIAL";

  const [planHidden, setPlanHidden] = useState(true);
  const [dismissedLitis, setDismissedLitis] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      setPlanHidden(localStorage.getItem(PLAN_DISMISS_KEY) === todayKey());
    } catch {
      setPlanHidden(false);
    }
    try {
      const raw = localStorage.getItem(LITIS_DISMISS_KEY);
      setDismissedLitis(raw ? (JSON.parse(raw) as Record<string, number>) : {});
    } catch {
      /* ignore */
    }
  }, []);

  function dismissPlanCard() {
    try {
      localStorage.setItem(PLAN_DISMISS_KEY, todayKey());
    } catch {
      /* ignore */
    }
    setPlanHidden(true);
  }

  function dismissLitis(userId: string) {
    const until = Date.now() + LITIS_DISMISS_DAYS * 86_400_000;
    setDismissedLitis((prev) => {
      const next = { ...prev, [userId]: until };
      try {
        localStorage.setItem(LITIS_DISMISS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const now = Date.now();
  const showPlanCard = !isSubscribed && !planHidden;
  const litisconsortes = (suggestions.data ?? [])
    .filter((s) => !(dismissedLitis[s.userId] > now))
    .slice(0, 5);

  useEffect(() => {
    const computeTop = () => {
      const railHeight = railRef.current?.offsetHeight ?? 0;
      const topPx = Math.min(0, window.innerHeight - railHeight);
      setStickyTop(`${topPx}px`);
    };

    computeTop();
    window.addEventListener("resize", computeTop);
    const observer = new ResizeObserver(computeTop);
    if (railRef.current) observer.observe(railRef.current);
    return () => {
      window.removeEventListener("resize", computeTop);
      observer.disconnect();
    };
  }, []);

  return (
    <aside
      ref={railRef}
      className="jq-sidebar-right"
      data-tour="right-rail"
      aria-label="Tendências e descoberta"
      style={{ "--jq-right-rail-top": stickyTop } as CSSProperties}
    >
      <a
        href="#jq-trends"
        className="sr-only focus:not-sr-only focus:absolute focus:right-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--jq-primary)] focus:px-3 focus:py-2 focus:text-[var(--jq-on-primary)]"
      >
        Pular para tendências
      </a>

      <div className={cn("jq-rail-search-sticky", scrolled && "jq-rail-search-sticky--scrolled")}>
        <RedeTesteSearchBox variant="rail" />
      </div>

      <div className="jq-rail-widgets space-y-4 pb-6 pt-2">
        {showPlanCard ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--jq-border)] bg-[var(--jq-surface)]">
            <div className="flex items-start justify-between p-4">
              <div>
                <p className="font-bold">Eleve seu Plano</p>
                <p className="mt-1 text-sm text-[var(--jq-muted)]">
                  Analytics, agendamento e publicações estendidas no Rede Teste Pro.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full p-1 text-[var(--jq-muted)] hover:bg-[var(--jq-bg)]/60 hover:text-[var(--jq-text)]"
                aria-label="Fechar"
                onClick={dismissPlanCard}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="px-4 pb-4">
              <Button
                asChild
                size="sm"
                className="rounded-full bg-[var(--jq-accent)] text-[var(--jq-on-primary)]"
              >
                <Link href="/rede-teste/plano">Assinar</Link>
              </Button>
            </div>
          </div>
        ) : null}

        <HojeNoDireito />

        <section
          id="jq-trends"
          className="overflow-hidden rounded-2xl border border-[var(--jq-border)] bg-[var(--jq-surface)]"
        >
          <h2 className="px-4 py-3 text-xl font-bold">Em pauta</h2>
          <ul>
            {trends.data?.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/rede-teste/explorar?q=${encodeURIComponent(`#${t.tag}`)}&type=hashtags`}
                  className="block px-4 py-3 transition hover:bg-[var(--jq-bg)]/50"
                >
                  <p className="text-xs text-[var(--jq-muted)]">Em pauta · Rede Teste</p>
                  <p className="font-bold">#{t.tag}</p>
                  <p className="text-xs text-[var(--jq-muted)]">
                    {t.publicationsCount}{" "}
                    {pluralize(t.publicationsCount, "publicação", "publicações")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/rede-teste/explorar"
            className="block px-4 py-3 text-sm text-[var(--jq-reply)] hover:bg-[var(--jq-bg)]/50"
          >
            Mostrar mais
          </Link>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--jq-border)] bg-[var(--jq-surface)]">
          <h2 className="px-4 py-3 text-xl font-bold">Litisconsortes</h2>
          <ul>
            {litisconsortes.map((s) => (
              <li key={s.userId} className="flex items-start gap-3 px-4 py-3">
                <JqAvatar src={s.image} name={s.displayName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-bold">
                    {s.displayName}
                    <JqVerifiedBadge type={s.verificationType} />
                  </p>
                  <p className="truncate text-sm text-[var(--jq-muted)]">
                    {formatJqHandle(s.handle)}
                  </p>
                  {s.reason ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--jq-reply)]">{s.reason}</p>
                  ) : s.bio ? (
                    <p className="mt-0.5 line-clamp-1 text-sm text-[var(--jq-muted)]">{s.bio}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <JqFollowButton
                    userId={s.userId}
                    following={s.following}
                    appearance="litis"
                  />
                  <button
                    type="button"
                    className="rounded-full p-1 text-[var(--jq-muted)] hover:bg-[var(--jq-bg)]/60 hover:text-[var(--jq-text)]"
                    aria-label={`Não sugerir ${s.displayName} por um tempo`}
                    title="Não sugerir por um tempo"
                    onClick={() => dismissLitis(s.userId)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {!litisconsortes.length && !suggestions.isLoading ? (
              <li className="px-4 py-3 text-sm text-[var(--jq-muted)]">
                Convide colegas e profissionais para crescer na rede.
              </li>
            ) : null}
          </ul>
        </section>

        <footer className="flex flex-wrap gap-x-2 gap-y-1 px-2 text-xs text-[var(--jq-muted)]">
          <Link href="/termos" className="hover:underline">
            Termos
          </Link>
          <span>·</span>
          <Link href="/privacidade" className="hover:underline">
            Privacidade
          </Link>
          <span>·</span>
          <span>© 2026 Rede Teste</span>
        </footer>
      </div>
    </aside>
  );
}
