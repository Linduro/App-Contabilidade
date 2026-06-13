"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { SharePublicationDmDialog } from "./share-publication-dm-dialog";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  publicationId: string;
  authorId: string;
  isAuthor: boolean;
  initialContent: string;
  onUpdated?: (content: string) => void;
  onDeleted?: () => void;
};

export function PublicationMoreMenu({
  publicationId,
  authorId,
  isAuthor,
  initialContent,
  onUpdated,
  onDeleted,
}: Props) {
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareDmOpen, setShareDmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [editContent, setEditContent] = useState(initialContent);
  const utils = trpc.useUtils();

  const report = trpc.redeTeste.reportPublication.useMutation({
    onSuccess: () => {
      toast.success("Denúncia registrada. Obrigado.");
      setReportOpen(false);
      setReason("");
    },
    onError: (e) => toast.error(e.message),
  });

  const block = trpc.redeTeste.blockUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário bloqueado");
      void utils.redeTeste.feed.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.redeTeste.updatePublication.useMutation({
    onSuccess: (data) => {
      toast.success("Publicação atualizada");
      setEditOpen(false);
      onUpdated?.(data.content);
      void utils.redeTeste.feed.invalidate();
      void utils.redeTeste.getPublication.invalidate({ id: publicationId });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.redeTeste.deletePublication.useMutation({
    onSuccess: () => {
      toast.success("Publicação excluída");
      setDeleteOpen(false);
      onDeleted?.();
      void utils.redeTeste.feed.invalidate();
      router.push("/rede-teste");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isAuthor) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="rounded-full p-1 text-[var(--jq-muted)] hover:bg-[var(--jq-surface)]"
              aria-label="Opções da publicação"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShareDmOpen(true)}>
              <Send className="mr-2 size-4" />
              Enviar por mensagem
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setEditContent(initialContent);
                setEditOpen(true);
              }}
            >
              <Pencil className="mr-2 size-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 size-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="border-[var(--jq-border)] bg-[var(--jq-bg)] text-[var(--jq-text)]">
            <DialogHeader>
              <DialogTitle>Editar publicação</DialogTitle>
            </DialogHeader>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              maxLength={560}
              rows={5}
              className="resize-none border-[var(--jq-border)] bg-[var(--jq-surface)]"
            />
            <p className="text-xs text-[var(--jq-muted)]">{560 - editContent.length} caracteres</p>
            <DialogFooter>
              <Button
                className="rounded-full bg-[var(--jq-primary)]"
                disabled={update.isPending || !editContent.trim()}
                onClick={() =>
                  update.mutate({ id: publicationId, content: editContent.trim() })
                }
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="border-[var(--jq-border)] bg-[var(--jq-bg)]">
            <DialogHeader>
              <DialogTitle>Excluir publicação?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[var(--jq-muted)]">
              Esta ação não pode ser desfeita. Comentários também serão ocultados.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: publicationId })}
              >
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <SharePublicationDmDialog
          publicationId={publicationId}
          authorUserId={authorId}
          open={shareDmOpen}
          onOpenChange={setShareDmOpen}
        />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="rounded-full p-1 text-[var(--jq-muted)] hover:bg-[var(--jq-surface)]"
            aria-label="Mais opções"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShareDmOpen(true)}>
            <Send className="mr-2 size-4" />
            Enviar por mensagem
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setReportOpen(true)}>Denunciar publicação</DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => block.mutate({ userId: authorId })}
          >
            Bloquear autor
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Denunciar publicação</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Descreva o motivo (spam, conteúdo inadequado, etc.)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />
          <Button
            className="w-full"
            disabled={report.isPending || reason.trim().length < 3}
            onClick={() => report.mutate({ publicationId, reason: reason.trim() })}
          >
            Enviar denúncia
          </Button>
        </DialogContent>
      </Dialog>

      <SharePublicationDmDialog
        publicationId={publicationId}
        authorUserId={authorId}
        open={shareDmOpen}
        onOpenChange={setShareDmOpen}
      />
    </>
  );
}
