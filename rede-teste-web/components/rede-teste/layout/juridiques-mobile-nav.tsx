"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Bell, Bookmark, PenLine, User } from "lucide-react";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc-client";

const items = [
  { href: "/rede-teste", icon: Home, label: "Início" },
  { href: "/rede-teste/explorar", icon: Search, label: "Explorar" },
  { href: "/rede-teste/salvos", icon: Bookmark, label: "Salvos" },
  { href: "/rede-teste/notificacoes", icon: Bell, label: "Notificações" },
];

type Props = {
  user: { name: string; image: string | null };
  onCompose?: () => void;
};

export function RedeTesteMobileNav({ user, onCompose }: Props) {
  const pathname = usePathname();
  const me = trpc.redeTeste.me.useQuery();
  const unreadNotif = trpc.redeTeste.unreadNotificationCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const notifBadge = unreadNotif.data?.count ?? 0;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[var(--jq-border)] bg-[var(--jq-bg)]/95 px-2 py-2 backdrop-blur-md lg:hidden"
      aria-label="Navegação móvel"
    >
      {items.slice(0, 2).map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("flex flex-col items-center p-2", active && "text-[var(--jq-primary)]")}
            aria-label={item.label}
          >
            <Icon className="size-6" />
          </Link>
        );
      })}

      <button
        type="button"
        className="-mt-6 flex size-14 items-center justify-center rounded-full bg-[var(--jq-primary)] text-[var(--jq-on-primary)] shadow-lg"
        aria-label="Nova publicação"
        onClick={() => onCompose?.()}
      >
        <PenLine className="size-6" />
      </button>

      {me.data?.handle ? (
        <Link
          href={jqProfilePath(me.data.handle)}
          className={cn(
            "flex flex-col items-center p-2",
            pathname.startsWith(jqProfilePath(me.data.handle)) && "text-[var(--jq-primary)]",
          )}
          aria-label="Meu perfil"
        >
          <User className="size-6" />
        </Link>
      ) : null}

      {items.slice(3).map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        const badge = item.href === "/rede-teste/notificacoes" ? notifBadge : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-col items-center p-2",
              active && "text-[var(--jq-primary)]",
            )}
            aria-label={item.label}
          >
            <Icon className="size-6" />
            {badge > 0 ? (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-[var(--jq-reply)] text-[10px] font-bold text-white">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
