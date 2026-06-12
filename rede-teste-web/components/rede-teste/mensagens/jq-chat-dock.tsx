"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc-client";
import {
  getRedeTesteTheme,
  type RedeTesteThemeMode,
} from "../rede-teste-theme-scope";
import { useJqChat } from "./jq-chat-context";
import { JqChatExpandedWindow, JqChatMinimizedBar } from "./jq-chat-window";

export function JqChatDock() {
  const { sessions, ensureMinimizedFromInbox } = useJqChat();
  const [theme, setTheme] = useState<RedeTesteThemeMode>("dark");

  const conversations = trpc.redeTeste.listConversations.useQuery(undefined, {
    enabled: sessions.length > 0,
    refetchInterval: sessions.length > 0 ? 20_000 : false,
    retry: 1,
  });

  const unreadByConvId = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of conversations.data ?? []) {
      map.set(c.id, c.unreadCount ?? 0);
    }
    return map;
  }, [conversations.data]);

  const unreadByPeerId = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of conversations.data ?? []) {
      if (c.peer?.userId) map.set(c.peer.userId, c.unreadCount ?? 0);
    }
    return map;
  }, [conversations.data]);

  useEffect(() => {
    if (!conversations.data?.length) return;
    ensureMinimizedFromInbox(conversations.data);
  }, [conversations.data, ensureMinimizedFromInbox]);

  useEffect(() => {
    setTheme(getRedeTesteTheme());
    const onCustom = () => setTheme(getRedeTesteTheme());
    window.addEventListener("rede-teste-theme-change", onCustom);
    return () => window.removeEventListener("rede-teste-theme-change", onCustom);
  }, []);

  if (sessions.length === 0 || typeof document === "undefined") return null;

  function unreadFor(session: (typeof sessions)[0]) {
    if (session.conversationId) {
      return unreadByConvId.get(session.conversationId) ?? 0;
    }
    return unreadByPeerId.get(session.peerUserId) ?? 0;
  }

  return createPortal(
    <div
      data-juridiques
      className={`jq-theme pointer-events-none ${theme === "dark" ? "jq-dark" : "jq-light"}`}
    >
      <div
        data-testid="jq-chat-dock"
        className="pointer-events-auto fixed bottom-20 right-4 z-[100] flex max-h-[calc(100svh-5rem)] flex-col-reverse items-end gap-2 lg:bottom-4"
      >
        {sessions.map((session) =>
          session.uiState === "expanded" ? (
            <JqChatExpandedWindow
              key={session.key}
              session={session}
              unreadCount={unreadFor(session)}
            />
          ) : (
            <JqChatMinimizedBar
              key={session.key}
              session={session}
              unreadCount={unreadFor(session)}
            />
          ),
        )}
      </div>
    </div>,
    document.body,
  );
}
