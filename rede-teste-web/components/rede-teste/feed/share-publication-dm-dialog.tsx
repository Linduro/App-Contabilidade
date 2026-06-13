"use client";

import { useMemo, useState } from "react";
import { Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { buildPublicationShareDmBody } from "@/lib/rede-teste/share-publication-dm";
import { formatJqHandle } from "@/lib/rede-teste/format";
import { JqAvatar } from "../shared/jq-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOptionalJqChat } from "../mensagens/jq-chat-context";
import { cn } from "@/lib/utils";

type Recipient = {
  userId: string;
  handle: string;
  displayName: string;
  image: string | null;
};

type Props = {
  publicationId: string;
  authorUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SharePublicationDmDialog({
  publicationId,
  authorUserId,
  open,
  onOpenChange,
}: Props) {
  const chat = useOptionalJqChat();
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Recipient | null>(null);
  const [sending, setSending] = useState(false);

  const following = trpc.redeTeste.listConnections.useQuery(
    { tab: "following" },
    { enabled: open },
  );

  const search = trpc.redeTeste.search.useQuery(
    { q: query.replace(/^@/, ""), type: "people", limit: 20 },
    { enabled: open && query.trim().length >= 2 },
  );

  const utils = trpc.useUtils();
  const me = trpc.redeTeste.me.useQuery(undefined, { enabled: open });
  const openConv = trpc.redeTeste.openConversation.useMutation();
  const sendMsg = trpc.redeTeste.sendMessage.useMutation();

  const recipients = useMemo(() => {
    const q = query.trim();
    if (q.length >= 2) {
      return (search.data?.people ?? []).map((p) => ({
        userId: p.userId,
        handle: p.handle,
        displayName: p.displayName,
        image: p.image,
      }));
    }
    const myId = me.data?.userId;
    return (following.data ?? []).filter(
      (p) => p.userId !== authorUserId && p.userId !== myId,
    );
  }, [query, search.data, following.data, authorUserId, me.data?.userId]);

  function reset() {
    setQuery("");
    setNote("");
    setSelected(null);
  }

  async function handleSend() {
    if (!selected) {
      toast.error("Escolha quem vai receber a mensagem");
      return;
    }
    setSending(true);
    try {
      const { conversationId } = await openConv.mutateAsync({
        otherUserId: selected.userId,
      });
      await sendMsg.mutateAsync({
        conversationId,
        body: buildPublicationShareDmBody(publicationId, note),
        sharedPublicationId: publicationId,
      });
      toast.success(`Enviado para ${selected.displayName}`);
      void utils.redeTeste.listConversations.invalidate();
      void utils.redeTeste.listMessages.invalidate({ conversationId });
      void utils.redeTeste.unreadDmCount.invalidate();
      onOpenChange(false);
      reset();
      chat.openExpanded({
        peerUserId: selected.userId,
        conversationId,
        peer: {
          handle: selected.handle,
          displayName: selected.displayName,
          image: selected.image,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[85vh] border-[var(--jq-border)] bg-[var(--jq-bg)] text-[var(--jq-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar publicação por mensagem</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--jq-muted)]" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Buscar @usuário ou nome…"
            className="border-[var(--jq-border)] bg-[var(--jq-surface)] pl-9"
          />
        </div>

        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-[var(--jq-border)] p-1">
          {following.isLoading && query.length < 2 ? (
            <li className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-[var(--jq-muted)]" />
            </li>
          ) : recipients.length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-[var(--jq-muted)]">
              {query.length >= 2
                ? "Nenhum usuário encontrado"
                : "Siga pessoas no Rede Teste ou busque pelo @"}
            </li>
          ) : (
            recipients.map((p) => (
              <li key={p.userId}>
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-[var(--jq-surface)]",
                    selected?.userId === p.userId && "bg-[var(--jq-primary)]/15 ring-1 ring-[var(--jq-primary)]/40",
                  )}
                >
                  <JqAvatar src={p.image} name={p.displayName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.displayName}</p>
                    <p className="truncate text-xs text-[var(--jq-muted)]">
                      {formatJqHandle(p.handle)}
                    </p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>

        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Comentário opcional"
          rows={2}
          maxLength={500}
          className="resize-none border-[var(--jq-border)] bg-[var(--jq-surface)]"
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            className="rounded-full bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
            disabled={sending || !selected}
            onClick={() => void handleSend()}
          >
            {sending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Send className="mr-2 size-4" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
