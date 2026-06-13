"use client";

import { useState } from "react";
import { Pencil, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Props = {
  communityId: string;
  name: string;
  description: string | null;
  isMember: boolean;
  memberRole: string | null;
  onUpdated?: () => void;
};

export function CommunitySettingsPanel({
  communityId,
  name,
  description,
  isMember,
  memberRole,
  onUpdated,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editDesc, setEditDesc] = useState(description ?? "");

  const utils = trpc.useUtils();
  const update = trpc.redeTeste.updateCommunity.useMutation({
    onSuccess: () => {
      toast.success("Comunidade atualizada");
      setEditing(false);
      void utils.redeTeste.listCommunities.invalidate();
      void utils.redeTeste.communityFeed.invalidate();
      onUpdated?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const leave = trpc.redeTeste.leaveCommunity.useMutation({
    onSuccess: () => {
      toast.success("Você saiu da comunidade");
      void utils.redeTeste.listCommunities.invalidate();
      onUpdated?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const isAdmin = memberRole === "ADMIN";

  if (!isMember) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--jq-border)] pt-3">
      {isAdmin ? (
        editing ? (
          <div className="w-full space-y-2">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome" />
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Descrição"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="rounded-full bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    communityId,
                    name: editName.trim(),
                    description: editDesc.trim() || null,
                  })
                }
              >
                Salvar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="jq-btn-outline rounded-full"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="jq-btn-outline rounded-full"
            onClick={() => setEditing(true)}
          >
            <Pencil className="mr-1 size-4" />
            Personalizar
          </Button>
        )
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="jq-btn-outline rounded-full text-destructive"
        disabled={leave.isPending}
        onClick={() => {
          if (window.confirm("Sair desta comunidade?")) {
            leave.mutate({ communityId });
          }
        }}
      >
        <LogOut className="mr-1 size-4" />
        Sair
      </Button>
    </div>
  );
}
