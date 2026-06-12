"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RedeTestePortalTheme } from "@/components/rede-teste/shared/rede-teste-portal-theme";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function JqPushPrompt() {
  const [open, setOpen] = useState(false);
  const vapid = trpc.redeTeste.pushVapidPublicKey.useQuery();
  const register = trpc.redeTeste.registerPushSubscription.useMutation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    const logins = Number(localStorage.getItem("jq-login-count") ?? "0");
    if (logins < 2) return;
    if (localStorage.getItem("jq-push-dismissed")) return;
    if (Notification.permission === "granted") return;
    setOpen(true);
  }, []);

  async function enablePush() {
    if (!vapid.data?.publicKey) {
      toast.error("Push não configurado no servidor (VAPID).");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        localStorage.setItem("jq-push-dismissed", "1");
        setOpen(false);
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw-jq.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.data.publicKey),
      });
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Subscription inválida");
      }
      await register.mutateAsync({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      toast.success("Notificações push ativadas");
      localStorage.setItem("jq-push-dismissed", "1");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ativar push");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-md">
        <RedeTestePortalTheme className="rounded-xl border border-[var(--jq-border)] bg-[var(--jq-bg)] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--jq-text)]">Notificações no navegador</DialogTitle>
            <DialogDescription className="text-[var(--jq-muted)]">
              Receba menções, mensagens e novos seguidores mesmo com a aba fechada. Você pode
              desativar a qualquer momento em configurações.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="jq-btn-outline rounded-full"
              onClick={() => {
                localStorage.setItem("jq-push-dismissed", "1");
                setOpen(false);
              }}
            >
              Agora não
            </Button>
            <Button
              type="button"
              className="rounded-full bg-[var(--jq-primary)] text-[var(--jq-on-primary)] hover:bg-[var(--jq-primary)]/90"
              disabled={register.isPending}
              onClick={() => void enablePush()}
            >
              Ativar
            </Button>
          </DialogFooter>
        </RedeTestePortalTheme>
      </DialogContent>
    </Dialog>
  );
}
