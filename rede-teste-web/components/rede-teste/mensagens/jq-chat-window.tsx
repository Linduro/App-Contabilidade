"use client";

import Link from "next/link";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Minimize2,
  Send,
  ImagePlus,
  FileText,
  SmilePlus,
  Mic,
  Inbox,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { formatTrpcErrorMessage } from "@/lib/trpc-error-message";
import { JqAvatar } from "../shared/jq-avatar";
import { formatJqHandle } from "@/lib/rede-teste/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useJqChat, type JqChatSession } from "./jq-chat-context";
import { JqMessageBubble } from "./jq-message-bubble";

type Props = {
  session: JqChatSession;
  unreadCount: number;
};

export function JqChatMinimizedBar({ session, unreadCount }: Props) {
  const { expand } = useJqChat();

  return (
    <button
      type="button"
      data-testid="jq-chat-minimized-bar"
      onClick={() => expand(session.key)}
      className="flex h-11 w-[min(320px,calc(100vw-2rem))] items-center gap-2 rounded-full border border-[var(--jq-border)] bg-[var(--jq-surface,#16181c)] px-3 shadow-lg transition hover:brightness-110"
      aria-label={`Abrir conversa com ${session.peer.displayName}`}
    >
      <JqAvatar src={session.peer.image} name={session.peer.displayName} size="sm" />
      <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[var(--jq-text)]">
        {session.peer.displayName}
      </span>
      {unreadCount > 0 ? (
        <span
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold leading-none text-white"
          aria-label={`${unreadCount} mensagens não lidas`}
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}

export function JqChatExpandedWindow({ session, unreadCount }: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const { minimize, close, setConversationId } = useJqChat();

  const openConv = trpc.redeTeste.openConversation.useMutation({
    onError: (e) => toast.error(formatTrpcErrorMessage(e)),
  });

  const conversationId =
    session.conversationId ?? openConv.data?.conversationId ?? null;

  useEffect(() => {
    if (!session.conversationId && openConv.data?.conversationId) {
      setConversationId(session.key, openConv.data.conversationId);
    }
  }, [session.conversationId, session.key, openConv.data?.conversationId, setConversationId]);

  useEffect(() => {
    if (session.conversationId) return;
    openConv.reset();
    openConv.mutate({ otherUserId: session.peerUserId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.peerUserId, session.conversationId]);

  const messages = trpc.redeTeste.listMessages.useQuery(
    { conversationId: conversationId!, limit: 50, markRead: true },
    {
      enabled: !!conversationId,
      refetchInterval: conversationId ? 4_000 : false,
    },
  );

  const send = trpc.redeTeste.sendMessage.useMutation({
    onSuccess: () => {
      setDraft("");
      if (!conversationId) return;
      void utils.juridiques.listMessages.invalidate({ conversationId });
      void utils.juridiques.listConversations.invalidate();
    },
    onError: (e) => toast.error(formatTrpcErrorMessage(e)),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  const opening = openConv.isPending || (!conversationId && !openConv.isError);
  const loadError = openConv.isError
    ? formatTrpcErrorMessage(openConv.error)
    : messages.isError
      ? formatTrpcErrorMessage(messages.error)
      : null;

  return (
    <aside
      data-testid="profile-chat-widget"
      className="flex h-[min(520px,calc(100svh-8rem))] w-[360px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-[var(--jq-border)] bg-[var(--jq-bg,#0f1419)] text-[var(--jq-text,#e8eaed)] shadow-2xl"
    >
      <header className="flex items-center justify-between border-b border-[var(--jq-border)] bg-[var(--jq-bg,#0f1419)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <JqAvatar src={session.peer.image} name={session.peer.displayName} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{session.peer.displayName}</p>
            <p className="truncate text-xs text-[var(--jq-muted)]">
              {formatJqHandle(session.peer.handle)}
            </p>
          </div>
          {unreadCount > 0 ? (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8 rounded-full" asChild>
            <Link href={jqProfilePath(session.peer.handle)} aria-label="Acessar perfil">
              <User className="size-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded-full" asChild>
            <Link
              href={
                conversationId
                  ? `/rede-teste/mensagens?c=${conversationId}`
                  : "/rede-teste/mensagens"
              }
              aria-label="Caixa geral de mensagens"
            >
              <Inbox className="size-4" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            aria-label="Minimizar chat"
            onClick={() => minimize(session.key)}
          >
            <Minimize2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full text-red-500 hover:bg-red-500/10 hover:text-red-600"
            aria-label="Fechar chat"
            onClick={() => close(session.key)}
          >
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-[var(--jq-bg,#0f1419)] px-3 py-3">
        {opening ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-[var(--jq-muted)]">
            <Loader2 className="size-5 animate-spin" />
            Abrindo conversa...
          </div>
        ) : loadError ? (
          <div className="flex h-full items-center justify-center px-2 text-center text-sm text-red-500">
            {loadError}
          </div>
        ) : messages.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-[var(--jq-muted)]" />
          </div>
        ) : (
          <div className="space-y-3">
            {(messages.data?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--jq-muted)]">
                Envie a primeira mensagem para {session.peer.displayName}.
              </p>
            ) : null}
            {messages.data?.map((m) => (
              <JqMessageBubble key={m.id} message={m} compact />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-[var(--jq-border)] bg-[var(--jq-bg,#0f1419)] px-3 py-2">
        <div className="mb-2 flex items-center gap-1">
          {[
            { label: "Anexar imagem", Icon: ImagePlus },
            { label: "Anexar documento", Icon: FileText },
            { label: "Enviar GIF", Icon: SmilePlus },
            { label: "Enviar áudio", Icon: Mic },
          ].map(({ label, Icon }) => (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              onClick={() => toast.message(`${label} estará disponível em breve.`)}
              aria-label={label}
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!conversationId || !draft.trim() || send.isPending) return;
            send.mutate({ conversationId, body: draft.trim() });
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Mensagem..."
            maxLength={2000}
            disabled={!conversationId || opening}
            className="h-9 border-[var(--jq-border)] bg-[var(--jq-surface)] text-[var(--jq-text)]"
          />
          <Button
            type="submit"
            size="icon"
            className="size-9 rounded-full bg-[var(--jq-primary)]"
            disabled={!conversationId || !draft.trim() || send.isPending || opening}
          >
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </form>
      </div>
    </aside>
  );
}
