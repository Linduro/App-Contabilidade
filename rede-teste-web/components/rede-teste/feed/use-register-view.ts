"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc-client";
import { getOrCreateJqViewSessionId } from "@/lib/rede-teste/view-session";
import { registerWatchedPublication } from "@/lib/rede-teste/watch-publications";

/** Registra visualização única (24h) ao montar ou ao entrar no viewport. */
export function useRegisterPublicationView(
  publicationId: string,
  options?: { enabled?: boolean; observe?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const observe = options?.observe ?? false;
  const registered = useRef(false);
  const register = trpc.redeTeste.registerView.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!observe || !publicationId) return;
    return registerWatchedPublication(publicationId);
  }, [observe, publicationId]);

  useEffect(() => {
    if (!enabled || !publicationId || registered.current) return;

    const run = () => {
      if (registered.current) return;
      registered.current = true;
      const sessionId = getOrCreateJqViewSessionId();
      register.mutate(
        { publicationId, sessionId: sessionId || undefined },
        {
          onSuccess: (res) => {
            if (res.counted) {
              void utils.redeTeste.getPublication.setData({ id: publicationId }, (old) =>
                old ? { ...old, viewsCount: res.viewsCount } : old,
              );
            }
          },
        },
      );
    };

    if (!observe) {
      run();
      return;
    }

    const el = document.getElementById(`jq-pub-${publicationId}`);
    if (!el || typeof IntersectionObserver === "undefined") {
      run();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.35, rootMargin: "0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, observe, publicationId, register, utils]);
}
