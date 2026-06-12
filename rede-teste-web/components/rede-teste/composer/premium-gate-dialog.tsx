"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
};

export function PremiumGateDialog({ open, onOpenChange, title, description }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--jq-border)] bg-[var(--jq-bg)] text-[var(--jq-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[var(--jq-muted)]">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[var(--jq-primary)] text-white hover:bg-[var(--jq-primary)]/90"
            asChild
          >
            <Link href="/billing">Conhecer plano</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
