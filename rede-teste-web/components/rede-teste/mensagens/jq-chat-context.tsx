"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type JqChatPeer = {
  userId: string;
  handle: string;
  displayName: string;
  image: string | null;
};

export type JqChatUiState = "expanded" | "minimized";

export type JqChatSession = {
  key: string;
  conversationId: string | null;
  peerUserId: string;
  peer: Omit<JqChatPeer, "userId">;
  uiState: JqChatUiState;
};

type OpenInput = {
  peerUserId: string;
  peer: Omit<JqChatPeer, "userId">;
  conversationId?: string | null;
};

type JqChatContextValue = {
  sessions: JqChatSession[];
  openExpanded: (input: OpenInput) => void;
  expand: (key: string) => void;
  minimize: (key: string) => void;
  close: (key: string) => void;
  setConversationId: (key: string, conversationId: string) => void;
  ensureMinimizedFromInbox: (
    items: {
      id: string;
      unreadCount: number;
      peer: {
        userId: string;
        handle: string;
        displayName: string;
        image: string | null;
      } | null;
    }[],
  ) => void;
};

const JqChatContext = createContext<JqChatContextValue | null>(null);

function sessionKey(peerUserId: string) {
  return `peer:${peerUserId}`;
}

export function JqChatProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<JqChatSession[]>([]);
  const dismissedRef = useRef<Set<string>>(new Set());
  const prevUnreadRef = useRef<Map<string, number>>(new Map());

  const openExpanded = useCallback((input: OpenInput) => {
    const key = sessionKey(input.peerUserId);
    if (input.conversationId) dismissedRef.current.delete(input.conversationId);
    dismissedRef.current.delete(key);

    setSessions((prev) => {
      const rest = prev
        .filter((s) => s.key !== key)
        .map((s) => ({ ...s, uiState: "minimized" as const }));
      const existing = prev.find((s) => s.key === key);
      const next: JqChatSession = existing
        ? {
            ...existing,
            uiState: "expanded",
            conversationId: input.conversationId ?? existing.conversationId,
          }
        : {
            key,
            conversationId: input.conversationId ?? null,
            peerUserId: input.peerUserId,
            peer: input.peer,
            uiState: "expanded",
          };
      return [...rest, next];
    });
  }, []);

  const expand = useCallback((key: string) => {
    dismissedRef.current.delete(key);
    setSessions((prev) => {
      const target = prev.find((s) => s.key === key);
      if (!target) return prev;
      return prev.map((s) =>
        s.key === key
          ? { ...s, uiState: "expanded" }
          : { ...s, uiState: "minimized" },
      );
    });
  }, []);

  const minimize = useCallback((key: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.key === key ? { ...s, uiState: "minimized" } : s)),
    );
  }, []);

  const close = useCallback((key: string) => {
    setSessions((prev) => {
      const session = prev.find((s) => s.key === key);
      if (session) {
        dismissedRef.current.add(session.conversationId ?? key);
      }
      return prev.filter((s) => s.key !== key);
    });
  }, []);

  const setConversationId = useCallback((key: string, conversationId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.key === key ? { ...s, conversationId } : s)),
    );
  }, []);

  const ensureMinimizedFromInbox = useCallback(
    (items: {
      id: string;
      unreadCount: number;
      peer: {
        userId: string;
        handle: string;
        displayName: string;
        image: string | null;
      } | null;
    }[]) => {
      setSessions((prev) => {
        let next = [...prev];
        for (const c of items) {
          const prevUnread = prevUnreadRef.current.get(c.id) ?? 0;
          prevUnreadRef.current.set(c.id, c.unreadCount);
          if (c.unreadCount > prevUnread) {
            dismissedRef.current.delete(c.id);
          }
          if (!c.peer || c.unreadCount <= 0) continue;
          const dismissKey = c.id;
          if (dismissedRef.current.has(dismissKey)) continue;

          const key = sessionKey(c.peer.userId);
          const existing = next.find(
            (s) => s.key === key || s.conversationId === c.id || s.peerUserId === c.peer!.userId,
          );
          if (existing?.uiState === "expanded") continue;

          if (existing) {
            next = next.map((s) =>
              s.key === existing.key
                ? { ...s, uiState: "minimized", conversationId: c.id }
                : s,
            );
          } else {
            next.push({
              key,
              conversationId: c.id,
              peerUserId: c.peer.userId,
              peer: {
                handle: c.peer.handle,
                displayName: c.peer.displayName,
                image: c.peer.image,
              },
              uiState: "minimized",
            });
          }
        }
        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      sessions,
      openExpanded,
      expand,
      minimize,
      close,
      setConversationId,
      ensureMinimizedFromInbox,
    }),
    [sessions, openExpanded, expand, minimize, close, setConversationId, ensureMinimizedFromInbox],
  );

  return (
    <JqChatContext.Provider value={value}>{children}</JqChatContext.Provider>
  );
}

export function useJqChat() {
  const ctx = useContext(JqChatContext);
  if (!ctx) {
    throw new Error("useJqChat deve ser usado dentro de JqChatProvider");
  }
  return ctx;
}

export function useOptionalJqChat() {
  return useContext(JqChatContext);
}
