"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import { useJqProfile } from "./profile-context";

type TabDef = { slug: string; label: string; ownerOnly?: boolean };

const TABS: TabDef[] = [
  { slug: "", label: "Publicações" },
  { slug: "respostas", label: "Respostas" },
  { slug: "destaques", label: "Destaques" },
  { slug: "artigos", label: "Artigos" },
  { slug: "midia", label: "Mídia" },
  { slug: "curtidas", label: "Curtidas", ownerOnly: true },
  { slug: "sobre", label: "Sobre" },
];

export function ProfileTabs() {
  const profile = useJqProfile();
  const pathname = usePathname();
  const base = jqProfilePath(profile.handle);

  const visible = TABS.filter((t) => !t.ownerOnly || profile.isSelf);

  return (
    <nav
      className="sticky top-[53px] z-10 flex overflow-x-auto border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/95 backdrop-blur-md"
      aria-label="Abas do perfil"
    >
      {visible.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active =
          tab.slug === ""
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(`${base}/${tab.slug}`);

        return (
          <Link
            key={tab.slug || "posts"}
            href={href}
            className={`shrink-0 px-4 py-3 text-sm font-medium transition hover:bg-[var(--jq-surface)]/50 ${
              active
                ? "border-b-2 border-[var(--jq-primary)] font-bold text-[var(--jq-text)]"
                : "text-[var(--jq-muted)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
