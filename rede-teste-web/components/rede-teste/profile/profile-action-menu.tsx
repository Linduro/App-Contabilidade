"use client";

import { useState } from "react";
import { MoreHorizontal, Share2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildRedeTesteProfileInviteUrl } from "@/lib/rede-teste/invite-url";
import { useJqProfile } from "./profile-context";
import { ProfileReportDialog } from "./profile-report-dialog";

export function ProfileActionMenu() {
  const p = useJqProfile();
  const utils = trpc.useUtils();
  const [reportOpen, setReportOpen] = useState(false);
  const muted = p.viewerMuted ?? false;

  const block = trpc.redeTeste.blockUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário bloqueado");
      void utils.redeTeste.profileByHandle.invalidate({ handle: p.handle });
    },
    onError: (e) => toast.error(e.message),
  });

  const mute = trpc.redeTeste.muteUser.useMutation({
    onSuccess: () => {
      toast.success("Notificações silenciadas");
      void utils.redeTeste.profileByHandle.invalidate({ handle: p.handle });
    },
    onError: (e) => toast.error(e.message),
  });

  const unmute = trpc.redeTeste.unmuteUser.useMutation({
    onSuccess: () => {
      toast.success("Notificações reativadas");
      void utils.redeTeste.profileByHandle.invalidate({ handle: p.handle });
    },
    onError: (e) => toast.error(e.message),
  });

  async function copyLink() {
    const url = buildRedeTesteProfileInviteUrl(p.handle);
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-full" aria-label="Mais ações">
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => void copyLink()}>Copiar link do perfil</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void copyLink();
              if (navigator.share) {
                void navigator.share({
                  title: p.displayName,
                  url: buildRedeTesteProfileInviteUrl(p.handle),
                });
              }
            }}
          >
            <Share2 className="mr-2 size-4" />
            Compartilhar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              muted ? unmute.mutate({ userId: p.userId }) : mute.mutate({ userId: p.userId })
            }
          >
            {muted ? "Reativar notificações" : "Silenciar"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={block.isPending}
            onClick={() => block.mutate({ userId: p.userId })}
          >
            Bloquear
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => setReportOpen(true)}
          >
            Denunciar perfil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileReportDialog open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}
