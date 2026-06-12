"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { JqAvatar } from "../shared/jq-avatar";
import { JqVerifiedBadge } from "../shared/jq-verified-badge";
import { showJqOabBetaBadge } from "@/lib/rede-teste/oab-badge";
import { formatJqHandle } from "@/lib/rede-teste/format";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import { cn } from "@/lib/utils";

type Tab = "following" | "followers";

export function ConnectionsView() {
  const [tab, setTab] = useState<Tab>("following");
  const list = trpc.redeTeste.listConnections.useQuery({ tab });

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/rede-teste" className="rounded-full p-2 hover:bg-[var(--jq-surface)]" aria-label="Voltar">
            ←
          </Link>
          <h1 className="text-xl font-bold">Conexões</h1>
        </div>
        <div className="mt-3 flex gap-2">
          {(["following", "followers"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                tab === t
                  ? "bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
                  : "bg-[var(--jq-surface)] text-[var(--jq-muted)] hover:text-[var(--jq-text)]",
              )}
            >
              {t === "following" ? "Seguindo" : "Seguidores"}
            </button>
          ))}
        </div>
      </header>

      {list.isLoading ? (
        <p className="p-8 text-center text-sm text-[var(--jq-muted)]">Carregando…</p>
      ) : list.data?.length === 0 ? (
        <p className="p-8 text-center text-sm text-[var(--jq-muted)]">
          {tab === "following"
            ? "Você ainda não segue ninguém. Explore sugestões na coluna direita do feed."
            : "Ninguém segue você ainda."}
        </p>
      ) : (
        <ul>
          {list.data?.map((p) => (
            <li key={p.userId} className="border-b border-[var(--jq-border)] px-4 py-3">
              <Link
                href={jqProfilePath(p.handle)}
                className="flex items-center gap-3 hover:bg-[var(--jq-surface)]/50"
              >
                <JqAvatar src={p.image} name={p.displayName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-bold">
                    {p.displayName}
                    <JqVerifiedBadge
                      type={p.oabVerified ? "LAWYER" : p.verificationType}
                      showOabBeta={showJqOabBetaBadge() && p.oabVerified}
                    />
                  </p>
                  <p className="text-sm text-[var(--jq-muted)]">{formatJqHandle(p.handle)}</p>
                  {p.bio ? (
                    <p className="mt-0.5 line-clamp-1 text-sm text-[var(--jq-muted)]">{p.bio}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
