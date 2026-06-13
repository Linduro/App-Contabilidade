"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { JRD_RADIOS, jrdUploadImage } from "./jurisdicao-utils";

type Blog = {
  title: string;
  description: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
  bgColor: string;
  textColor: string;
  accentColor: string;
  bgImageUrl: string | null;
  fontFamily: string;
  radioUrl?: string | null;
  radioLabel?: string | null;
  radioAutoplay?: boolean;
};

const FONTS = [
  { value: "serif", label: "Serifada (clássica)" },
  { value: "sans", label: "Sem serifa" },
  { value: "mono", label: "Monoespaçada" },
  { value: "cursive", label: "Cursiva (Comic)" },
];

export function JurisdicaoCustomizeDialog({
  blog,
  open,
  onOpenChange,
  onSaved,
}: {
  blog: Blog;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(blog.title);
  const [description, setDescription] = useState(blog.description ?? "");
  const [avatarUrl, setAvatarUrl] = useState(blog.avatarUrl);
  const [headerUrl, setHeaderUrl] = useState(blog.headerUrl);
  const [bgColor, setBgColor] = useState(blog.bgColor);
  const [textColor, setTextColor] = useState(blog.textColor);
  const [accentColor, setAccentColor] = useState(blog.accentColor);
  const [bgImageUrl, setBgImageUrl] = useState(blog.bgImageUrl);
  const [fontFamily, setFontFamily] = useState(blog.fontFamily);
  const [radioUrl, setRadioUrl] = useState(blog.radioUrl ?? "");
  const [radioLabel, setRadioLabel] = useState(blog.radioLabel ?? "");
  const [radioAutoplay, setRadioAutoplay] = useState(blog.radioAutoplay ?? true);
  const [busy, setBusy] = useState<string | null>(null);

  const radioPreset =
    JRD_RADIOS.find((r) => r.url === radioUrl)?.id ?? (radioUrl ? "custom" : "");

  const update = trpc.jurisdicao.updateBlog.useMutation({
    onSuccess: () => {
      toast.success("Jurisdição atualizada");
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  async function upload(kind: string, file: File, set: (u: string) => void) {
    setBusy(kind);
    try {
      set(await jrdUploadImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setBusy(null);
    }
  }

  function save() {
    update.mutate({
      title: title.trim() || undefined,
      description: description.trim(),
      avatarUrl: avatarUrl,
      headerUrl: headerUrl,
      bgColor,
      textColor,
      accentColor,
      bgImageUrl: bgImageUrl,
      fontFamily: fontFamily as "serif" | "sans" | "mono" | "cursive",
      radioUrl: radioUrl.trim() ? radioUrl.trim() : null,
      radioLabel: radioLabel.trim() ? radioLabel.trim() : null,
      radioAutoplay,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Personalizar Jurisdição</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Título do blog">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <ColorField label="Fundo" value={bgColor} onChange={setBgColor} />
            <ColorField label="Texto" value={textColor} onChange={setTextColor} />
            <ColorField label="Destaque" value={accentColor} onChange={setAccentColor} />
          </div>

          <Field label="Fonte">
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>

          <ImageField
            label="Avatar"
            url={avatarUrl}
            busy={busy === "avatar"}
            onUpload={(f) => void upload("avatar", f, setAvatarUrl)}
            onClear={() => setAvatarUrl(null)}
          />
          <ImageField
            label="Cabeçalho (banner do topo)"
            url={headerUrl}
            busy={busy === "header"}
            onUpload={(f) => void upload("header", f, setHeaderUrl)}
            onClear={() => setHeaderUrl(null)}
          />
          <ImageField
            label="Imagem de fundo (repetida)"
            url={bgImageUrl}
            busy={busy === "bg"}
            onUpload={(f) => void upload("bg", f, setBgImageUrl)}
            onClear={() => setBgImageUrl(null)}
          />

          <div className="rounded-md border p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
              Rádio (toca automaticamente para quem visita)
            </p>
            <Field label="Estação">
              <select
                value={radioPreset}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id === "") {
                    setRadioUrl("");
                    setRadioLabel("");
                  } else if (id === "custom") {
                    setRadioUrl(radioPreset === "custom" ? radioUrl : "");
                  } else {
                    const r = JRD_RADIOS.find((x) => x.id === id);
                    if (r) {
                      setRadioUrl(r.url);
                      setRadioLabel(r.label);
                    }
                  }
                }}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Nenhuma</option>
                {JRD_RADIOS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
                <option value="custom">Outra (URL personalizada)…</option>
              </select>
            </Field>
            {radioPreset === "custom" ? (
              <div className="mt-2 space-y-2">
                <input
                  value={radioUrl}
                  onChange={(e) => setRadioUrl(e.target.value)}
                  placeholder="https://stream-da-radio.com/stream"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={radioLabel}
                  onChange={(e) => setRadioLabel(e.target.value)}
                  placeholder="Nome da rádio"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
            ) : null}
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={radioAutoplay}
                onChange={(e) => setRadioAutoplay(e.target.checked)}
              />
              Tocar automaticamente ao abrir
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border px-4 py-2 text-sm"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              disabled={update.isPending || !!busy}
              onClick={save}
            >
              {update.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer rounded-md border bg-background"
      />
    </label>
  );
}

function ImageField({
  label,
  url,
  busy,
  onUpload,
  onClear,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  onUpload: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-12 rounded-md border object-cover" />
        ) : null}
        <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm">
          {busy ? <Loader2 className="size-4 animate-spin" /> : url ? "Trocar" : "Enviar"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
        {url ? (
          <button type="button" className="text-sm text-destructive" onClick={onClear}>
            Remover
          </button>
        ) : null}
      </div>
    </div>
  );
}
