"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { JqAvatar } from "../shared/jq-avatar";
import { JqVerifiedBadge } from "../shared/jq-verified-badge";
import { pluralize } from "@/lib/i18n/plural";
import { cn } from "@/lib/utils";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import {
  clearJqReferralHandle,
  getJqReferralHandle,
} from "@/lib/rede-teste/referral-storage";
import { useJqChat } from "../mensagens/jq-chat-context";
import { toast } from "sonner";
import { useJqProfile } from "./profile-context";
import { ProfileMetadataRow } from "./profile-metadata-row";
import { ProfileActionMenu } from "./profile-action-menu";
import { EditProfileModal } from "./edit-profile-modal";
import { JqMediaLightbox } from "../shared/jq-media-lightbox";

export function ProfileHeader() {
  const p = useJqProfile();
  const { openExpanded } = useJqChat();
  const [editOpen, setEditOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; type: string }[] | null>(null);
  const utils = trpc.useUtils();

  const follow = trpc.redeTeste.toggleFollow.useMutation({
    onSuccess: () => {
      clearJqReferralHandle();
      void utils.juridiques.profileByHandle.invalidate({ handle: p.handle });
      void utils.juridiques.suggestions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const pubLabel = pluralize(
    p.publicationsCount,
    "publicação",
    "publicações",
  );

  return (
    <header className="border-b border-[var(--jq-border)]">
      <div className="sticky top-0 z-20 flex items-center gap-4 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link href="/rede-teste" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight">{p.displayName}</h1>
          <p className="truncate text-sm text-[var(--jq-muted)]">
            {p.publicationsCount} {pubLabel}
          </p>
        </div>
      </div>

      {p.bannerUrl ? (
        <button
          type="button"
          className="block h-32 w-full cursor-zoom-in bg-gradient-to-r from-[var(--jq-primary)] to-[#243656]"
          style={{
            backgroundImage: `url(${p.bannerUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-label="Ver banner do perfil"
          onClick={() => setLightbox([{ url: p.bannerUrl!, type: "IMAGE" }])}
        />
      ) : (
        <div
          className="h-32 bg-gradient-to-r from-[var(--jq-primary)] to-[#243656]"
          role="img"
          aria-label="Banner do perfil"
        />
      )}

      <div className="flex items-end justify-between px-4 pb-2">
        {p.image ? (
          <button
            type="button"
            className="-mt-16 cursor-zoom-in rounded-full border-4 border-[var(--jq-bg)]"
            aria-label="Ver foto do perfil"
            onClick={() => setLightbox([{ url: p.image!, type: "IMAGE" }])}
          >
            <JqAvatar src={p.image} name={p.displayName} size="xl" />
          </button>
        ) : (
          <div className="-mt-16 rounded-full border-4 border-[var(--jq-bg)]">
            <JqAvatar src={p.image} name={p.displayName} size="xl" />
          </div>
        )}
        <div className="flex gap-2 pb-1">
          {p.isSelf ? (
            <Button
              variant="ghost"
              className="rounded-full border border-[var(--jq-border)] bg-white text-black hover:bg-neutral-100 hover:text-black"
              onClick={() => setEditOpen(true)}
            >
              Editar perfil
            </Button>
          ) : (
            <>
              <ProfileActionMenu />
              <Button
                variant="ghost"
                className="rounded-full border border-[var(--jq-border)] bg-white text-black hover:bg-neutral-100 hover:text-black"
                onClick={() =>
                  openExpanded({
                    peerUserId: p.userId,
                    peer: {
                      handle: p.handle,
                      displayName: p.displayName,
                      image: p.image,
                    },
                  })
                }
              >
                Mensagem
              </Button>
              <Button
                className={cn(
                  "rounded-full",
                  p.viewerFollowing &&
                    "border border-[var(--jq-border)] bg-white text-black hover:bg-neutral-100 hover:text-black",
                )}
                variant={p.viewerFollowing ? "ghost" : "default"}
                disabled={follow.isPending}
                onClick={() =>
                  follow.mutate({
                    userId: p.userId,
                    refHandle: getJqReferralHandle() ?? undefined,
                  })
                }
              >
                {follow.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : p.viewerFollowing ? (
                  "Seguindo"
                ) : (
                  "Seguir"
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pb-2">
        <p className="flex items-center gap-1 text-xl font-bold">
          {p.displayName}
          <JqVerifiedBadge
            type={p.verificationType}
            showOabBeta={p.verificationType === "LAWYER" && !p.oabRegistryVerified}
          />
        </p>
      </div>

      <ProfileMetadataRow />

      <div className="mt-3 flex flex-wrap gap-4 px-4 pb-4 text-sm">
        <span>
          <strong>{p.followingCount}</strong>{" "}
          <span className="text-[var(--jq-muted)]">seguindo</span>
        </span>
        <span>
          <strong>{p.followersCount}</strong>{" "}
          <span className="text-[var(--jq-muted)]">seguidores</span>
        </span>
      </div>

      {p.isSelf ? (
        <EditProfileModal open={editOpen} onOpenChange={setEditOpen} />
      ) : null}

      {lightbox ? (
        <JqMediaLightbox
          open
          items={lightbox}
          index={0}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </header>
  );
}
