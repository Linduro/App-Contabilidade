"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Search,
  Bell,
  Users,
  MessageCircle,
  Bookmark,
  Bot,
  Layers,
  Scale,
  Crown,
  User,
  MoreHorizontal,
  PenLine,
  ArrowLeft,
  Shield,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RedeTesteModeSwitch } from "@/components/product-mode-switch";
import { ThemeToggleMenu } from "@/components/theme-toggle-menu";
import { trpc } from "@/lib/trpc-client";
import { JqAvatar } from "../shared/jq-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { isRedeTesteAssistantNavEnabled } from "@/lib/rede-teste/nav-items";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";

const navItems = [
  { href: "/rede-teste", label: "Início", icon: Home },
  { href: "/rede-teste/explorar", label: "Explorar", icon: Search },
  { href: "/rede-teste/jurisprudencia", label: "Jurisprudência", icon: Scale },
  { href: "/rede-teste/notificacoes", label: "Notificações", icon: Bell },
  { href: "/rede-teste/conexoes", label: "Conexões", icon: Users },
  { href: "/rede-teste/mensagens", label: "Mensagens", icon: MessageCircle },
  { href: "/rede-teste/salvos", label: "Salvos", icon: Bookmark },
  { href: "/jurisdicao", label: "Jurisdição", icon: Layers, newTab: true },
  { href: "/rede-teste/assistente", label: "Estagiário Artificial", icon: Bot },
  { href: "/rede-teste/plano", label: "Plano", icon: Crown },
];

type Props = {
  user: { name: string; email: string; image: string | null };
  onCompose?: () => void;
};

export function RedeTesteSidebar({ user, onCompose }: Props) {
  const pathname = usePathname();
  const me = trpc.redeTeste.me.useQuery();
  const profileHref = me.data?.handle
    ? jqProfilePath(me.data.handle)
    : "/rede-teste/configuracoes";
  const handleLabel = me.data?.handle ? `@${me.data.handle}` : user.name;
  const unreadNotif = trpc.redeTeste.unreadNotificationCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const unreadDm = trpc.redeTeste.unreadDmCount.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const visibleNav = navItems.filter((item) => {
    if (item.href === "/rede-teste/assistente") return isRedeTesteAssistantNavEnabled();
    return true;
  });
  const navItemsWithBadge = visibleNav.map((item) => {
    if (item.href === "/rede-teste/notificacoes") {
      return { ...item, badge: unreadNotif.data?.count ?? 0, badgeVariant: "reply" as const };
    }
    if (item.href === "/rede-teste/mensagens") {
      return { ...item, badge: unreadDm.data?.count ?? 0, badgeVariant: "dm" as const };
    }
    return { ...item, badge: 0 as number, badgeVariant: "reply" as const };
  });

  async function handleSignOut() {
    try {
      await signOut();
      window.location.href = "/login";
    } catch {
      toast.error("Não foi possível sair da conta");
    }
  }

  return (
    <aside
      className="jq-sidebar-nav flex w-full flex-col bg-[var(--jq-bg)] px-2 py-2 xl:px-3"
      aria-label="Navegação Rede Teste"
    >
      <div className="mb-2 flex min-w-0 items-start justify-between gap-2 px-1">
        <RedeTesteModeSwitch
          mode="juridiques"
          compact
          className="min-w-0 flex-1 xl:hidden"
        />
        <RedeTesteModeSwitch
          mode="juridiques"
          className="hidden min-w-0 flex-1 xl:inline-flex"
        />
        <ThemeToggleMenu variant="juridiques" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {navItemsWithBadge.map((item) => {
          const newTab = "newTab" in item && item.newTab;
          const active =
            !newTab &&
            item.href !== "#" &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              aria-disabled={item.disabled}
              target={newTab ? "_blank" : undefined}
              rel={newTab ? "noopener noreferrer" : undefined}
              className={cn(
                "group flex items-center gap-3.5 rounded-full px-3 py-2 text-base transition hover:bg-[var(--jq-surface)] xl:px-4",
                active && "font-bold",
                item.disabled && "pointer-events-none opacity-50",
              )}
            >
              <Icon className="size-[22px] shrink-0" strokeWidth={active ? 2.5 : 2} />
              <span className="hidden xl:inline">{item.label}</span>
              {item.badge != null && item.badge > 0 ? (
                <span
                  className={cn(
                    "ml-auto flex size-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none text-white xl:ml-0",
                    item.badgeVariant === "dm" ? "bg-red-600" : "bg-[var(--jq-reply)]",
                  )}
                >
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}

        <Button
          data-tour="compose"
          className="mt-3 hidden h-11 w-full max-w-[200px] rounded-full bg-[var(--jq-primary)] text-base font-bold text-[var(--jq-on-primary)] hover:bg-[var(--jq-primary)]/90 xl:flex"
          onClick={() => onCompose?.()}
        >
          <PenLine className="mr-2 size-5" />
          Publicar
        </Button>
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="mt-auto flex w-full items-center gap-3 rounded-full p-2 text-left transition hover:bg-[var(--jq-surface)]"
          >
            <JqAvatar src={user.image} name={user.name} size="md" />
            <div className="hidden min-w-0 flex-1 xl:block">
              <p className="truncate text-sm font-bold">{handleLabel}</p>
            </div>
            <MoreHorizontal className="size-5 shrink-0 text-[var(--jq-muted)]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 size-4" />
              Voltar ao Portal
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={profileHref}>
              <User className="mr-2 size-4" />
              Meu perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/rede-teste/configuracoes">
              <Settings className="mr-2 size-4" />
              Configurações
            </Link>
          </DropdownMenuItem>
          {me.data?.isOwner ? (
            <DropdownMenuItem asChild>
              <Link href="/rede-teste/moderacao">
                <Shield className="mr-2 size-4" />
                Moderação
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="mr-2 size-4" />
            Sair da conta
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </aside>
  );
}
