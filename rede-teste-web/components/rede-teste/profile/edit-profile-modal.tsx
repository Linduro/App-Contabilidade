"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { JqAvatar } from "../shared/jq-avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  JQ_PROFESSIONAL_KINDS,
  JQ_PROFESSIONAL_KIND_LABELS,
} from "@/lib/rede-teste/profile/professional-kind";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import { useJqProfile } from "./profile-context";

const schema = z.object({
  displayName: z.string().min(1).max(50),
  bio: z.string().max(160),
  location: z.string().max(30),
  website: z.string().max(100),
  lawFirm: z.string().max(80),
  bannerUrl: z.string().max(500),
  practiceAreasText: z.string().max(400),
  professionalKind: z.string(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditProfileModal({ open, onOpenChange }: Props) {
  const profile = useJqProfile();
  const utils = trpc.useUtils();
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.image ?? null);

  const update = trpc.redeTeste.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado");
      void utils.redeTeste.profileByHandle.invalidate({ handle: profile.handle });
      void utils.redeTeste.me.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: "",
      bio: "",
      location: "",
      website: "",
      lawFirm: "",
      bannerUrl: "",
      practiceAreasText: "",
      professionalKind: "",
    },
  });

  const { register, handleSubmit, reset, watch, formState } = form;
  const bioLen = watch("bio")?.length ?? 0;

  useEffect(() => {
    if (!open) return;
    setAvatarPreview(profile.image ?? null);
    reset({
      displayName: profile.displayName,
      bio: profile.bio ?? "",
      location: profile.location ?? "",
      website: profile.website ?? "",
      lawFirm: profile.lawFirm ?? "",
      bannerUrl: profile.bannerUrl ?? "",
      practiceAreasText: profile.practiceAreas.join(", "),
      professionalKind: profile.professionalKind ?? "",
    });
  }, [open, profile, reset]);

  async function onBannerSelected(file: File | null) {
    if (!file) return;
    setBannerUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "banner");
      const res = await fetch("/api/rede-teste/profile-media", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as { bannerUrl?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha no upload");
      if (json.bannerUrl) {
        form.setValue("bannerUrl", json.bannerUrl, { shouldDirty: true });
        toast.success("Capa enviada");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na capa");
    } finally {
      setBannerUploading(false);
    }
  }

  async function onAvatarSelected(file: File | null) {
    if (!file) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "avatar");
      const res = await fetch("/api/rede-teste/profile-media", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as { avatarUrl?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Falha no upload");
      if (json.avatarUrl) {
        setAvatarPreview(json.avatarUrl);
        void utils.redeTeste.me.invalidate();
        void utils.redeTeste.profileByHandle.invalidate({ handle: profile.handle });
        toast.success("Foto atualizada");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na foto");
    } finally {
      setAvatarUploading(false);
    }
  }

  function onSubmit(data: FormValues) {
    const areas = data.practiceAreasText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    update.mutate({
      displayName: data.displayName,
      bio: data.bio || null,
      location: data.location || null,
      website: data.website || null,
      lawFirm: data.lawFirm || null,
      bannerUrl: data.bannerUrl || null,
      practiceAreas: areas,
      professionalKind:
        data.professionalKind && JQ_PROFESSIONAL_KINDS.includes(data.professionalKind as (typeof JQ_PROFESSIONAL_KINDS)[number])
          ? (data.professionalKind as (typeof JQ_PROFESSIONAL_KINDS)[number])
          : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Foto e capa</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={bannerUploading}
                aria-label="Alterar capa"
                className="group relative block h-28 w-full overflow-hidden rounded-lg bg-gradient-to-r from-[var(--jq-primary)] to-[#243656]"
                style={
                  watch("bannerUrl")
                    ? {
                        backgroundImage: `url(${watch("bannerUrl")})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                  {bannerUploading ? (
                    <Loader2 className="size-6 animate-spin text-white" />
                  ) : (
                    <Camera className="size-6 text-white" />
                  )}
                </span>
                {bannerUploading ? (
                  <span className="absolute right-2 top-2 rounded-full bg-black/50 p-1">
                    <Loader2 className="size-4 animate-spin text-white" />
                  </span>
                ) : (
                  <span className="absolute right-2 top-2 rounded-full bg-black/45 p-1.5">
                    <Camera className="size-4 text-white" />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                aria-label="Alterar foto"
                className="group absolute -bottom-7 left-4 rounded-full border-4 border-[var(--jq-bg)]"
              >
                <JqAvatar src={avatarPreview} name={profile.displayName} size="xl" />
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
                  {avatarUploading ? (
                    <Loader2 className="size-5 animate-spin text-white" />
                  ) : (
                    <Camera className="size-5 text-white" />
                  )}
                </span>
              </button>
            </div>
            <div className="h-7" />
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void onBannerSelected(e.target.files?.[0] ?? null)}
            />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void onAvatarSelected(e.target.files?.[0] ?? null)}
            />
            <Input
              id="bannerUrl"
              {...register("bannerUrl")}
              placeholder="ou cole a URL da capa https://…"
              className="text-xs"
            />
          </div>
          <div>
            <Label htmlFor="displayName">Nome</Label>
            <Input id="displayName" {...register("displayName")} maxLength={50} />
          </div>
          <div>
            <Label htmlFor="bio">Bio ({bioLen}/160)</Label>
            <Textarea id="bio" {...register("bio")} rows={3} maxLength={160} />
          </div>
          <div>
            <Label htmlFor="location">Localização</Label>
            <Input id="location" {...register("location")} maxLength={30} />
          </div>
          <div>
            <Label htmlFor="website">Site</Label>
            <Input id="website" {...register("website")} placeholder="https://…" />
          </div>
          <div>
            <Label htmlFor="professionalKind">Tipo profissional</Label>
            <select
              id="professionalKind"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register("professionalKind")}
            >
              <option value="">—</option>
              {JQ_PROFESSIONAL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {JQ_PROFESSIONAL_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="lawFirm">Escritório / instituição</Label>
            <Input id="lawFirm" {...register("lawFirm")} maxLength={80} />
          </div>
          <div>
            <Label htmlFor="practiceAreasText">Áreas (separadas por vírgula)</Label>
            <Input id="practiceAreasText" {...register("practiceAreasText")} />
          </div>
          <p className="text-xs text-muted-foreground">
            <a href={jqProfilePath(profile.handle)} className="text-[var(--jq-reply)] underline">
              Ver perfil público
            </a>
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!formState.isDirty || update.isPending}
            >
              {update.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
