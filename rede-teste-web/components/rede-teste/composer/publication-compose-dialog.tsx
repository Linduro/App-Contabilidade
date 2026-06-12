"use client";

import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RedeTestePortalTheme } from "@/components/rede-teste/shared/rede-teste-portal-theme";
import { PublicationComposer } from "./publication-composer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { name: string; image: string | null };
  initialContent?: string;
  sourceIntimationId?: string;
  communityId?: string;
  enablePoll?: boolean;
};

export function PublicationComposeDialog({
  open,
  onOpenChange,
  user,
  initialContent,
  sourceIntimationId,
  communityId,
  enablePoll,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[min(90vh,720px)] overflow-hidden border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
      >
        <RedeTestePortalTheme className="relative flex max-h-[min(90vh,720px)] flex-col overflow-hidden rounded-xl border border-[var(--jq-border)] bg-[var(--jq-bg)] shadow-2xl">
          <DialogClose
            className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-[var(--jq-muted)] transition hover:bg-[var(--jq-surface)] hover:text-[var(--jq-text)]"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </DialogClose>
          <DialogHeader className="shrink-0 border-b border-[var(--jq-border)] px-4 py-3 pr-12">
            <DialogTitle className="text-left text-lg font-bold text-[var(--jq-text)]">
              Nova publicação
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PublicationComposer
              user={user}
              variant="juridiques"
              communityId={communityId}
              enablePoll={enablePoll}
              initialContent={initialContent}
              sourceIntimationId={sourceIntimationId}
              placeholder="O que está acontecendo no Direito?"
              onPublished={() => onOpenChange(false)}
            />
          </div>
        </RedeTestePortalTheme>
      </DialogContent>
    </Dialog>
  );
}
