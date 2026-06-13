"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CheckSquare,
  Loader2,
  MoreHorizontal,
  Send,
  Square,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc-client";
import { JqAvatar } from "../shared/jq-avatar";
import { JqMessageBubble } from "./jq-message-bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatJqHandle } from "@/lib/rede-teste/format";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import { cn } from "@/lib/utils";

type Folder = "inbox" | "archived";

export function MessagesView() {
  const searchParams = useSearchParams();
  const initialC = searchParams.get("c");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [activeId, setActiveId] = useState<string | null>(initialC);
  const [draft, setDraft] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const conversations = trpc.redeTeste.listConversations.useQuery(
    { folder },
    { refetchInterval: 15_000, retry: 2 },
  );
  const messages = trpc.redeTeste.listMessages.useQuery(
    { conversationId: activeId! },
    { enabled: !!activeId, refetchInterval: activeId ? 6_000 : false, retry: 2 },
  );

  const send = trpc.redeTeste.sendMessage.useMutation({
    onSuccess: () => {
      setDraft("");
      void utils.redeTeste.listMessages.invalidate({ conversationId: activeId! });
      void utils.redeTeste.listConversations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const archive = trpc.redeTeste.archiveConversation.useMutation({
    onSuccess: () => {
      toast.success("Conversa arquivada");
      setActiveId(null);
      void utils.redeTeste.listConversations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const unarchive = trpc.redeTeste.unarchiveConversation.useMutation({
    onSuccess: () => {
      toast.success("Conversa restaurada na caixa de entrada");
      setFolder("inbox");
      void utils.redeTeste.listConversations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.redeTeste.deleteConversation.useMutation({
    onSuccess: () => {
      toast.success("Conversa excluída");
      setActiveId(null);
      void utils.redeTeste.listConversations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkArchive = trpc.redeTeste.bulkArchiveConversations.useMutation({
    onSuccess: (d) => {
      toast.success(`${d.count} conversa(s) arquivada(s)`);
      setSelectedIds([]);
      setSelectMode(false);
      setActiveId(null);
      void utils.redeTeste.listConversations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkDelete = trpc.redeTeste.bulkDeleteConversations.useMutation({
    onSuccess: (d) => {
      toast.success(`${d.count} conversa(s) excluída(s)`);
      setSelectedIds([]);
      setSelectMode(false);
      setActiveId(null);
      void utils.redeTeste.listConversations.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const follow = trpc.redeTeste.toggleFollow.useMutation({
    onSuccess: (data) => {
      toast.success(data.following ? "Agora você segue este perfil" : "Deixou de seguir");
      void utils.redeTeste.listConversations.invalidate();
      void utils.redeTeste.profileByHandle.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  useEffect(() => {
    if (!conversations.data?.some((c) => c.id === activeId)) {
      setActiveId(null);
    }
  }, [conversations.data, activeId]);

  const activeConv = conversations.data?.find((c) => c.id === activeId);

  function ConversationMenu({ conversationId }: { conversationId: string }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-full"
            aria-label="Opções da conversa"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {folder === "inbox" ? (
            <DropdownMenuItem
              onClick={() => archive.mutate({ conversationId })}
            >
              <Archive className="mr-2 size-4" />
              Arquivar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => unarchive.mutate({ conversationId })}
            >
              <ArchiveRestore className="mr-2 size-4" />
              Mover para caixa de entrada
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => {
              if (window.confirm("Excluir esta conversa da sua lista?")) {
                remove.mutate({ conversationId });
              }
            }}
          >
            <Trash2 className="mr-2 size-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col lg:min-h-svh lg:flex-row">
      <aside
        className={`border-b border-[var(--jq-border)] lg:w-[320px] lg:border-b-0 lg:border-r ${
          activeId ? "hidden lg:block" : "block"
        }`}
      >
        <header className="border-b border-[var(--jq-border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/rede-teste"
              className="text-sm text-[var(--jq-reply)] hover:underline lg:hidden"
            >
              ←
            </Link>
            <h1 className="text-xl font-bold">Mensagens</h1>
            {conversations.data && conversations.data.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto rounded-full text-xs"
                onClick={() => {
                  setSelectMode((v) => !v);
                  setSelectedIds([]);
                }}
              >
                {selectMode ? "Cancelar" : "Selecionar"}
              </Button>
            ) : null}
          </div>
          {selectMode && selectedIds.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {folder === "inbox" ? (
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
                  disabled={bulkArchive.isPending}
                  onClick={() => bulkArchive.mutate({ conversationIds: selectedIds })}
                >
                  Arquivar ({selectedIds.length})
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="jq-btn-outline rounded-full"
                disabled={bulkDelete.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Excluir ${selectedIds.length} conversa(s) da sua lista?`,
                    )
                  ) {
                    bulkDelete.mutate({ conversationIds: selectedIds });
                  }
                }}
              >
                Excluir
              </Button>
            </div>
          ) : null}
          <nav className="mt-3 flex gap-2" aria-label="Pastas">
            {(["inbox", "archived"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFolder(f);
                  setActiveId(null);
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition",
                  folder === f
                    ? "bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
                    : "bg-[var(--jq-surface)] text-[var(--jq-muted)] hover:bg-[var(--jq-border)]",
                )}
              >
                {f === "inbox" ? "Caixa de entrada" : "Arquivadas"}
              </button>
            ))}
          </nav>
        </header>
        {conversations.isLoading ? (
          <p className="p-6 text-sm text-[var(--jq-muted)]">Carregando…</p>
        ) : conversations.data?.length === 0 ? (
          <p className="p-6 text-sm text-[var(--jq-muted)]">
            {folder === "archived"
              ? "Nenhuma conversa arquivada."
              : "Nenhuma conversa. Abra uma pelo perfil de alguém (botão Mensagem)."}
          </p>
        ) : (
          <ul>
            {conversations.data?.map((c) => (
              <li key={c.id} className="flex items-center border-b border-[var(--jq-border)]/50">
                {selectMode ? (
                  <button
                    type="button"
                    className="shrink-0 px-3 text-[var(--jq-muted)]"
                    aria-label={selectedIds.includes(c.id) ? "Desmarcar" : "Marcar"}
                    onClick={() => toggleSelected(c.id)}
                  >
                    {selectedIds.includes(c.id) ? (
                      <CheckSquare className="size-5 text-[var(--jq-primary)]" />
                    ) : (
                      <Square className="size-5" />
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (selectMode) {
                      toggleSelected(c.id);
                      return;
                    }
                    setActiveId(c.id);
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--jq-surface)] ${
                    activeId === c.id && !selectMode ? "bg-[var(--jq-surface)]" : ""
                  }`}
                >
                  <JqAvatar
                    src={c.peer?.image ?? null}
                    name={c.peer?.displayName ?? "?"}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.peer?.displayName}</p>
                    <p className="truncate text-xs text-[var(--jq-muted)]">
                      {c.lastMessage
                        ? `${c.lastMessage.isMine ? "Você: " : ""}${c.lastMessage.body}`
                        : formatJqHandle(c.peer?.handle ?? "")}
                    </p>
                  </div>
                  {c.unreadCount > 0 ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                      {c.unreadCount > 9 ? "9+" : c.unreadCount}
                    </span>
                  ) : null}
                </button>
                {!selectMode ? <ConversationMenu conversationId={c.id} /> : null}
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section
        className={`flex flex-1 flex-col ${!activeId ? "hidden lg:flex" : "flex"}`}
      >
        {!activeId ? (
          <p className="m-auto p-8 text-sm text-[var(--jq-muted)]">
            Selecione uma conversa
          </p>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b border-[var(--jq-border)] px-4 py-3">
              <button
                type="button"
                className="text-sm text-[var(--jq-reply)] lg:hidden"
                onClick={() => setActiveId(null)}
              >
                ←
              </button>
              {activeConv?.peer ? (
                <>
                  <Link href={jqProfilePath(activeConv.peer.handle)}>
                    <JqAvatar
                      src={activeConv.peer.image}
                      name={activeConv.peer.displayName}
                      size="sm"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={jqProfilePath(activeConv.peer.handle)}
                      className="font-bold hover:underline"
                    >
                      {activeConv.peer.displayName}
                    </Link>
                    <p className="text-xs text-[var(--jq-muted)]">
                      {formatJqHandle(activeConv.peer.handle)}
                    </p>
                  </div>
                  {!activeConv.peer.viewerFollowing ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="jq-btn-outline hidden shrink-0 rounded-full sm:inline-flex"
                      disabled={follow.isPending}
                      onClick={() =>
                        follow.mutate({ userId: activeConv.peer!.userId })
                      }
                    >
                      {follow.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          <UserPlus className="mr-1 size-4" />
                          Seguir
                        </>
                      )}
                    </Button>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 rounded-full"
                        aria-label="Opções"
                      >
                        <MoreHorizontal className="size-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {activeConv.peer && !activeConv.peer.viewerFollowing ? (
                        <DropdownMenuItem
                          className="sm:hidden"
                          onClick={() =>
                            follow.mutate({ userId: activeConv.peer!.userId })
                          }
                        >
                          <UserPlus className="mr-2 size-4" />
                          Seguir
                        </DropdownMenuItem>
                      ) : null}
                      {folder === "inbox" ? (
                        <DropdownMenuItem
                          onClick={() =>
                            archive.mutate({ conversationId: activeId })
                          }
                        >
                          <Archive className="mr-2 size-4" />
                          Arquivar
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() =>
                            unarchive.mutate({ conversationId: activeId })
                          }
                        >
                          <ArchiveRestore className="mr-2 size-4" />
                          Desarquivar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Excluir esta conversa? Você pode iniciar outra pelo perfil da pessoa.",
                            )
                          ) {
                            remove.mutate({ conversationId: activeId });
                          }
                        }}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Excluir conversa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : null}
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.isLoading ? (
                <Loader2 className="mx-auto size-6 animate-spin text-[var(--jq-muted)]" />
              ) : (
                <div className="space-y-3">
                  {messages.data?.map((m) => (
                    <JqMessageBubble key={m.id} message={m} />
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <form
              className="flex gap-2 border-t border-[var(--jq-border)] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim() || !activeId) return;
                send.mutate({ conversationId: activeId, body: draft.trim() });
              }}
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escreva uma mensagem…"
                className="flex-1 border-[var(--jq-border)] bg-[var(--jq-surface)]"
                maxLength={2000}
              />
              <Button
                type="submit"
                size="icon"
                disabled={send.isPending || !draft.trim()}
                className="shrink-0 rounded-full bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
              >
                {send.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
