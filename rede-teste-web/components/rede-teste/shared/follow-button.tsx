"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  following: boolean;
  size?: "sm" | "default";
  className?: string;
  /** Botões brancos com texto preto (rail Litisconsortes) */
  appearance?: "default" | "litis";
  onSuccess?: (following: boolean) => void;
};

const litisBtn =
  "border border-[var(--jq-border)] bg-white text-black hover:bg-white/90 hover:text-black";

export function JqFollowButton({
  userId,
  following,
  size = "sm",
  className,
  appearance = "default",
  onSuccess,
}: Props) {
  const utils = trpc.useUtils();
  const toggle = trpc.redeTeste.toggleFollow.useMutation({
    onSuccess: (data) => {
      toast.success(data.following ? "Agora você segue este perfil" : "Deixou de seguir");
      void utils.juridiques.suggestions.invalidate();
      void utils.juridiques.discoverPeople.invalidate();
      void utils.juridiques.listConversations.invalidate();
      onSuccess?.(data.following);
    },
    onError: (e) => toast.error(e.message),
  });

  const isLitis = appearance === "litis";
  // Estado "Seguindo": botão branco com texto preto (legível em ambos os temas).
  const followingBtn =
    "border border-[var(--jq-border)] bg-white text-black hover:bg-neutral-100 hover:text-black";

  return (
    <Button
      type="button"
      size={size}
      variant={isLitis || following ? "ghost" : "default"}
      className={cn(
        "shrink-0 rounded-full font-semibold",
        isLitis && litisBtn,
        !isLitis && following && followingBtn,
        className,
      )}
      disabled={toggle.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate({ userId });
      }}
    >
      {toggle.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : following ? (
        "Seguindo"
      ) : (
        "Seguir"
      )}
    </Button>
  );
}
