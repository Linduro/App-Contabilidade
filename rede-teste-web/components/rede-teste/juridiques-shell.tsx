"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { PublicationComposeDialog } from "./composer/publication-compose-dialog";
import { JqRefTracker } from "./referral/jq-ref-tracker";
import { RedeTesteSidebar } from "./layout/rede-teste-sidebar";
import { RedeTesteRightRail } from "./layout/rede-teste-right-rail";
import { RedeTesteMobileNav } from "./layout/rede-teste-mobile-nav";
import { RedeTesteModeSwitch } from "@/components/product-mode-switch";
import { ThemeToggleMenu } from "@/components/theme-toggle-menu";
import { RedeTesteThemeScope } from "./rede-teste-theme-scope";
import { PostLoginShell } from "@/components/rede-teste-shell";
import { useRedeTesteEvents } from "./use-juridiques-events";
import { JqChatProvider } from "./mensagens/jq-chat-context";
import { JqChatDock } from "./mensagens/jq-chat-dock";
import { JqPushPrompt } from "./onboarding/jq-push-prompt";
import { JqGuidedTour } from "./onboarding/jq-guided-tour";
import { JqLayoutFrame } from "./layout/jq-layout-frame";
import { Loader2 } from "lucide-react";
type RedeTesteShellProps = {
  children: ReactNode;
  user: { name: string; email: string; image: string | null };
};

function RedeTesteShellInner({ children, user }: RedeTesteShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const me = trpc.redeTeste.me.useQuery();
  const isOnboarding = pathname.startsWith("/rede-teste/onboarding");
  const isHomeFeed = pathname === "/rede-teste";
  const hideRightRail = pathname.startsWith("/rede-teste/mensagens");
  const shareDraftId = searchParams.get("shareDraft");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<{
    content: string;
    sourceIntimationId?: string;
  } | null>(null);
  const composeUser = { name: user.name, image: user.image };

  useRedeTesteEvents();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const n = Number(localStorage.getItem("jq-login-count") ?? "0") + 1;
    localStorage.setItem("jq-login-count", String(n));
  }, []);

  useEffect(() => {
    if (me.isLoading || !me.data || isOnboarding) return;
    if (!me.data.onboardingCompleted) {
      router.replace("/rede-teste/onboarding");
    }
  }, [me.data, me.isLoading, isOnboarding, router]);

  useEffect(() => {
    if (me.data?.onboardingCompleted && isOnboarding) {
      router.replace("/rede-teste");
    }
  }, [me.data?.onboardingCompleted, isOnboarding, router]);

  const shareQuery = trpc.redeTeste.buildIntimationShare.useQuery(
    { intimationId: shareDraftId! },
    { enabled: !!shareDraftId },
  );

  useEffect(() => {
    if (!shareDraftId) return;
    setComposeOpen(true);
  }, [shareDraftId]);

  useEffect(() => {
    if (!shareQuery.data) return;
    setComposeDraft({
      content: shareQuery.data.content,
      sourceIntimationId: shareQuery.data.intimationId,
    });
  }, [shareQuery.data]);

  function handleComposeOpenChange(open: boolean) {
    setComposeOpen(open);
    if (!open && shareDraftId) {
      setComposeDraft(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("shareDraft");
      router.replace(url.pathname + url.search);
    }
  }

  if (isOnboarding) {
    return <>{children}</>;
  }

  if (me.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[var(--jq-bg)] text-[var(--jq-muted)]">
        <Loader2 className="size-8 animate-spin" aria-label="Carregando Rede Teste" />
      </div>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <JqRefTracker />
      </Suspense>
      <a
        href="#jq-main-feed"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-[var(--jq-primary)] focus:px-3 focus:py-2 focus:text-white"
      >
        Pular para o feed
      </a>

      <JqLayoutFrame
        isHomeFeed={isHomeFeed}
        className={hideRightRail ? "jq-layout--no-right-rail" : undefined}
      >
        <div className="jq-sidebar-left">
          <RedeTesteSidebar user={user} onCompose={() => setComposeOpen(true)} />
        </div>

        <div className="jq-feed-column">
          <header className="z-30 shrink-0 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 backdrop-blur-md lg:hidden">
            <div className="flex h-[3.25rem] items-center justify-between gap-2 px-3">
              <RedeTesteModeSwitch mode="juridiques" compact className="min-w-0 flex-1" />
              <ThemeToggleMenu variant="juridiques" />
            </div>
          </header>

          {isHomeFeed ? (
            children
          ) : (
            <main id="jq-main-feed" className="jq-feed pb-20 lg:pb-0">
              {children}
            </main>
          )}
        </div>

        {!hideRightRail ? <RedeTesteRightRail /> : null}
      </JqLayoutFrame>

      <RedeTesteMobileNav user={user} onCompose={() => setComposeOpen(true)} />
      <PublicationComposeDialog
        open={composeOpen}
        onOpenChange={handleComposeOpenChange}
        user={composeUser}
        initialContent={composeDraft?.content}
        sourceIntimationId={composeDraft?.sourceIntimationId}
      />
      <JqChatDock />
      <JqPushPrompt />
      <JqGuidedTour />
    </>
  );
}

export function RedeTesteShell(props: RedeTesteShellProps) {
  return (
    <RedeTesteThemeScope>
      <JqChatProvider>
        <PostLoginShell>
          <Suspense fallback={null}>
            <RedeTesteShellInner {...props} />
          </Suspense>
        </PostLoginShell>
      </JqChatProvider>
    </RedeTesteThemeScope>
  );
}
