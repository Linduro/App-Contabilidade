"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  CalendarClock,
  Check,
  GitBranch,
  ImageIcon,
  Lock,
  Scale,
  Settings2,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { JqAvatar } from "../shared/jq-avatar";
import { Button } from "@/components/ui/button";
import { normalizeMediaUrl } from "@/lib/media-url";
import { PRACTICE_AREAS } from "@/lib/rede-teste/format";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  JQ_COMPOSER_MAX_CHARS,
  countComposerChars,
  extractFirstUrl,
  validatePollOptions,
} from "@/lib/rede-teste/composer-validations";
import { clearActiveDraft } from "@/lib/rede-teste/draft-storage";
import { clearJqComposerPrefill, loadJqComposerPrefill } from "@/lib/templates/rede-teste-bridge";
import type { JqLinkPreview } from "@/lib/rede-teste/link-preview-parsers";
import { cn } from "@/lib/utils";
import { PremiumGateDialog } from "./premium-gate-dialog";
import { ComposerEmojiPicker } from "./composer-emoji-picker";
import { ComposerGifPicker, type SelectedGif } from "./composer-gif-picker";
import { ComposerCourtPicker } from "./composer-court-picker";
import { ComposerPollEditor, type PollState } from "./composer-poll-editor";
import { ComposerLinkPreview } from "./composer-link-preview";
import {
  ComposerScheduleDialog,
  formatScheduledLabel,
} from "./composer-schedule-dialog";
import { ComposerDraftsDrawer } from "./composer-drafts-drawer";
import { BarChart3 } from "lucide-react";
import type { PublicationItem } from "../feed/publication-card";

type Props = {
  user: { id?: string; name: string; image: string | null };
  parentId?: string;
  communityId?: string;
  placeholder?: string;
  /** Recebe a publicação criada quando é um post principal (para inserir no topo do feed). */
  onPublished?: (created?: PublicationItem) => void;
  initialContent?: string;
  sourceIntimationId?: string;
  variant?: "juridiques";
  /** Limpa rascunho local ao sair da página (feed início) */
  clearDraftOnLeave?: boolean;
  /** Em modo resposta: se o post pai permite respostas com GIF. */
  parentAllowGifReplies?: boolean;
};

type PendingMedia = { id: string; url: string; type: string };
type ThreadBlock = {
  content: string;
  media: PendingMedia[];
  gif: SelectedGif | null;
};

function insertAtCursor(el: HTMLTextAreaElement | null, text: string, value: string, set: (v: string) => void) {
  if (!el) {
    set(value + text);
    return;
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const next = value.slice(0, start) + text + value.slice(end);
  set(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
  });
}

export function PublicationComposer({
  user,
  parentId,
  communityId,
  placeholder,
  onPublished,
  initialContent,
  sourceIntimationId,
  clearDraftOnLeave = false,
  parentAllowGifReplies = true,
}: Props) {
  const pathname = usePathname();
  const isReply = !!parentId;
  const showFullComposer = !isReply;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [resumeDraftFocus, setResumeDraftFocus] = useState<{
    pos: number;
    key: number;
  } | null>(null);
  const utils = trpc.useUtils();
  const me = trpc.redeTeste.me.useQuery();
  const caps = trpc.redeTeste.composerCapabilities.useQuery();

  const userId = me.data?.userId ?? user.id ?? "";

  const [content, setContent] = useState(initialContent ?? "");
  const [practiceArea, setPracticeArea] = useState("");

  useEffect(() => {
    if (!userId || isReply || initialContent) return;
    const prefill = loadJqComposerPrefill(userId);
    if (!prefill?.content) return;
    const header = prefill.attachmentLabel
      ? `📎 ${prefill.attachmentLabel}\n\n`
      : "";
    setContent(header + prefill.content);
    clearJqComposerPrefill(userId);
    toast.message("Documento do Portal carregado no compositor. Revise antes de publicar.");
  }, [userId, isReply, initialContent]);
  const [isConfidential, setIsConfidential] = useState(false);
  const [allowGifReplies, setAllowGifReplies] = useState(true);
  const [media, setMedia] = useState<PendingMedia[]>([]);
  const [gif, setGif] = useState<SelectedGif | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pollMode, setPollMode] = useState(false);
  const [poll, setPoll] = useState<PollState>({
    question: "",
    options: ["", ""],
    durationDays: 1,
  });
  const [court, setCourt] = useState<{ id: string; code: string; name: string } | null>(null);
  const [linkPreview, setLinkPreview] = useState<JqLinkPreview | null>(null);
  const [linkPreviewRemoved, setLinkPreviewRemoved] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [draftSavedHint, setDraftSavedHint] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [threadBlocks, setThreadBlocks] = useState<ThreadBlock[]>([]);
  const [gate, setGate] = useState<"junior" | "pleno" | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  useEffect(() => {
    if (initialContent) setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    if (!clearDraftOnLeave || !userId || isReply) return;
    return () => {
      clearActiveDraft(userId);
    };
  }, [clearDraftOnLeave, userId, isReply, pathname]);

  useEffect(() => {
    if (!clearDraftOnLeave || !userId || isReply) return;
    const onBeforeUnload = () => clearActiveDraft(userId);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [clearDraftOnLeave, userId, isReply]);

  useEffect(() => {
    if (!resumeDraftFocus || pollMode) return;
    const { pos } = resumeDraftFocus;
    const focusInput = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      const caret = Math.min(pos, el.value.length);
      el.setSelectionRange(caret, caret);
    };
    focusInput();
    const t = window.setTimeout(focusInput, 0);
    setResumeDraftFocus(null);
    return () => clearTimeout(t);
  }, [resumeDraftFocus, content, pollMode]);

  useEffect(() => {
    if (linkPreviewRemoved || pollMode || gif || media.length) return;
    const url = extractFirstUrl(content);
    if (!url) {
      setLinkPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/og-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (res.ok) setLinkPreview(data as JqLinkPreview);
      } catch {
        /* silencioso */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [content, linkPreviewRemoved, pollMode, gif, media.length]);

  useEffect(() => {
    setDraftSavedHint(false);
  }, [content, practiceArea, court]);

  async function onPickMedia(file: File) {
    if (gif) {
      toast.error("Remova o GIF antes de adicionar imagem ou vídeo.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/rede-teste/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no upload");
      setMedia((prev) =>
        prev.length >= 4
          ? prev
          : [...prev, { id: data.id, url: data.url, type: data.type ?? "IMAGE" }],
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  const create = trpc.redeTeste.createPublication.useMutation({
    onSuccess: (data, variables) => {
      resetComposer();
      if (userId) clearActiveDraft(userId);
      void utils.redeTeste.feed.invalidate();
      void utils.redeTeste.me.invalidate();
      void utils.redeTeste.listScheduledPublications.invalidate();
      void utils.redeTeste.listDrafts.invalidate();
      if (variables.parentId) {
        void utils.redeTeste.getPublication.invalidate({ id: variables.parentId });
        void utils.redeTeste.replies.invalidate({ parentId: variables.parentId });
      }
      void utils.redeTeste.userPublications.invalidate();
      if (variables.communityId) {
        void utils.redeTeste.communityFeed.invalidate();
      }
      if (variables.scheduledAt) {
        toast.success(`Publicação agendada para ${formatScheduledLabel(variables.scheduledAt)}`);
      } else if (variables.saveAsDraft) {
        setDraftSavedHint(true);
        toast.success("Rascunho salvo");
      } else {
        toast.success(parentId ? "Resposta enviada" : "Publicação enviada");
      }
      if (data && !variables.saveAsDraft && !variables.scheduledAt) {
        onPublished?.(data as unknown as PublicationItem);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  function resetComposer() {
    setContent("");
    setPracticeArea("");
    setIsConfidential(false);
    setAllowGifReplies(true);
    setMedia([]);
    setGif(null);
    setPollMode(false);
    setPoll({ question: "", options: ["", ""], durationDays: 1 });
    setCourt(null);
    setLinkPreview(null);
    setLinkPreviewRemoved(false);
    setScheduledAt(null);
    setActiveDraftId(null);
    setThreadBlocks([]);
    setDraftSavedHint(false);
  }

  const charCount = countComposerChars(pollMode ? poll.question : content);
  const remaining = JQ_COMPOSER_MAX_CHARS - charCount;

  const hasThread = threadBlocks.length > 0;
  const validPoll =
    pollMode &&
    poll.question.trim().length > 0 &&
    !validatePollOptions(poll.options);

  const canPost =
    (pollMode
      ? validPoll
      : content.trim().length > 0 || media.length > 0 || !!gif || hasThread) &&
    !create.isPending &&
    !uploading;

  const submit = useCallback(() => {
    const mainContent = pollMode ? poll.question.trim() : content.trim();
    const pollPayload = validPoll
      ? {
          options: poll.options.map((o) => o.trim()).filter(Boolean),
          durationDays: poll.durationDays,
        }
      : undefined;

    const threadPosts =
      hasThread && caps.data?.threads
        ? [
            {
              content: mainContent,
              mediaIds: media.length ? media.map((m) => m.id) : undefined,
              externalGifUrl: gif?.url,
            },
            ...threadBlocks.map((b) => ({
              content: b.content.trim(),
              mediaIds: b.media.length ? b.media.map((m) => m.id) : undefined,
              externalGifUrl: b.gif?.url,
            })),
          ].filter((p) => p.content || p.mediaIds?.length || p.externalGifUrl)
        : undefined;

    create.mutate({
      content: mainContent || " ",
      practiceArea: practiceArea || undefined,
      parentId,
      communityId,
      isConfidential: !parentId && isConfidential,
      allowGifReplies: !parentId ? allowGifReplies : undefined,
      sourceIntimationId: !parentId ? sourceIntimationId : undefined,
      mediaIds: !threadPosts && media.length ? media.map((m) => m.id) : threadPosts ? undefined : undefined,
      externalGifUrl: !threadPosts && gif ? gif.url : undefined,
      poll: pollPayload,
      courtId: court?.id,
      linkPreview: linkPreview && !linkPreviewRemoved ? linkPreview : undefined,
      scheduledAt: scheduledAt ?? undefined,
      saveAsDraft: false,
      draftId: activeDraftId ?? undefined,
      threadPosts,
    });
  }, [
    pollMode,
    poll,
    content,
    validPoll,
    hasThread,
    caps.data?.threads,
    media,
    gif,
    threadBlocks,
    create,
    practiceArea,
    parentId,
    communityId,
    isConfidential,
    sourceIntimationId,
    court,
    linkPreview,
    linkPreviewRemoved,
    scheduledAt,
    activeDraftId,
    allowGifReplies,
  ]);

  function saveDraftManual() {
    create.mutate({
      content: content.trim() || " ",
      practiceArea: practiceArea || undefined,
      courtId: court?.id,
      saveAsDraft: true,
      draftId: activeDraftId ?? undefined,
    });
  }

  const toolbarBtn =
    "size-8 rounded-full text-[var(--jq-reply)] hover:bg-[var(--jq-primary)]/15 hover:text-[var(--jq-primary)] data-[active=true]:bg-[var(--jq-primary)]/20 data-[active=true]:text-[var(--jq-primary)]";

  function renderToolbar() {
    const disabledMedia = uploading || !!gif || pollMode || media.length >= 4 || isReply;
    const disabledGif =
      uploading ||
      media.length > 0 ||
      !!gif ||
      pollMode ||
      (isReply && !parentAllowGifReplies);
    const disabledPoll = media.length > 0 || !!gif || isReply;

    return (
      <>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPickMedia(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={toolbarBtn}
          disabled={disabledMedia}
          aria-label="Adicionar imagem ou vídeo"
          title="Imagem ou vídeo"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="size-5" strokeWidth={1.75} />
        </Button>
        <ComposerEmojiPicker
          onPick={(emoji) => insertAtCursor(textareaRef.current, emoji, pollMode ? poll.question : content, (v) =>
            pollMode ? setPoll({ ...poll, question: v }) : setContent(v),
          )}
        />
        <ComposerGifPicker
          disabled={disabledGif}
          onSelect={(g) => {
            if (media.length) {
              toast.error("Remova a mídia antes de adicionar um GIF.");
              return;
            }
            setGif(g);
          }}
        />
        {showFullComposer ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(toolbarBtn, scheduledAt && "text-[var(--jq-primary)]")}
              aria-label="Agendar publicação"
              title="Agendar publicação"
              onClick={() => {
                if (!caps.data?.schedule) {
                  setGate("junior");
                  return;
                }
                setScheduleOpen(true);
              }}
            >
              <CalendarClock className="size-5" strokeWidth={1.75} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(toolbarBtn, pollMode && "text-[var(--jq-primary)]")}
              disabled={disabledPoll}
              aria-label="Criar enquete"
              title="Enquete"
              data-active={pollMode}
              onClick={() => {
                if (media.length || gif) {
                  toast.error("Remova a mídia antes de criar uma enquete.");
                  return;
                }
                setPollMode((v) => !v);
              }}
            >
              <BarChart3 className="size-5" strokeWidth={1.75} />
            </Button>
            <ComposerCourtPicker
              disabled={pollMode}
              value={court}
              onChange={setCourt}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(toolbarBtn, hasThread && "text-[var(--jq-primary)]")}
              aria-label="Criar thread de publicações"
              title="Thread (publicações encadeadas)"
              onClick={() => {
                if (!caps.data?.threads) {
                  setGate("pleno");
                  return;
                }
                setThreadBlocks((b) =>
                  b.length >= 9 ? b : [...b, { content: "", media: [], gif: null }],
                );
              }}
            >
              <GitBranch className="size-5" strokeWidth={1.75} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full text-orange-500 hover:bg-orange-500/15 hover:text-orange-600"
                  aria-label="Área do Direito"
                  title={practiceArea ? `Área do Direito: ${practiceArea}` : "Área do Direito"}
                >
                  <Scale className="size-5" strokeWidth={practiceArea ? 2.5 : 1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-72 w-56 overflow-y-auto border-[var(--jq-border)] bg-[var(--jq-bg)] text-[var(--jq-text)]"
              >
                <DropdownMenuItem
                  className={cn(!practiceArea && "font-semibold text-[var(--jq-primary)]")}
                  onClick={() => setPracticeArea("")}
                >
                  Nenhuma área
                </DropdownMenuItem>
                {PRACTICE_AREAS.map((a) => (
                  <DropdownMenuItem
                    key={a}
                    className={cn(
                      practiceArea === a && "font-semibold text-[var(--jq-primary)]",
                    )}
                    onClick={() => setPracticeArea(a)}
                  >
                    {a}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </>
    );
  }

  return (
    <div className="border-b border-[var(--jq-border)] bg-[var(--jq-bg)] px-4 py-4">
      <PremiumGateDialog
        open={gate === "junior"}
        onOpenChange={(o) => !o && setGate(null)}
        title="Disponível no plano Junior"
        description="Agende publicações para data e hora futuras com o plano Solo (Junior) ou superior."
      />
      <PremiumGateDialog
        open={gate === "pleno"}
        onOpenChange={(o) => !o && setGate(null)}
        title="Disponível no plano Pleno"
        description="Publique threads com até 10 publicações encadeadas no plano Equipe (Pleno) ou Escritório."
      />
      <ComposerScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        onConfirm={(d) => setScheduledAt(d)}
      />

      <div className="flex items-start gap-3">
        <JqAvatar src={user.image ?? me.data?.image} name={user.name} size="lg" />
        <div className="relative min-w-0 flex-1">
          {showFullComposer ? (
            <div className="absolute right-0 top-0 z-10">
              <ComposerDraftsDrawer
                onContinue={(d) => {
                  const text = d.content;
                  setContent(text);
                  setPracticeArea(d.practiceArea ?? "");
                  setActiveDraftId(d.id);
                  setResumeDraftFocus({ pos: text.length, key: Date.now() });
                }}
              />
            </div>
          ) : null}
          <label htmlFor="jq-composer-input" className="sr-only">
            {pollMode ? "Pergunta da enquete" : "Nova publicação"}
          </label>
          {!pollMode ? (
            <textarea
              ref={textareaRef}
              id="jq-composer-input"
              rows={2}
              maxLength={JQ_COMPOSER_MAX_CHARS}
              placeholder={placeholder ?? "O que está acontecendo no Direito?"}
              className="w-full resize-none border-0 bg-transparent pr-10 text-lg outline-none placeholder:text-[var(--jq-muted)]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
            />
          ) : null}

          {pollMode ? (
            <ComposerPollEditor
              poll={{ ...poll, question: poll.question || content }}
              onChange={(p) => {
                setPoll(p);
                setContent(p.question);
              }}
              onClose={() => setPollMode(false)}
            />
          ) : null}

          {gif ? (
            <div className="relative mt-2 inline-block overflow-hidden rounded-lg border border-[var(--jq-border)]">
              <span className="absolute left-1 top-1 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-[var(--jq-primary)]">
                GIF
              </span>
              <Image
                src={gif.previewUrl}
                alt=""
                width={160}
                height={120}
                className="object-cover"
                unoptimized
              />
              <button
                type="button"
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                aria-label="Remover GIF"
                onClick={() => setGif(null)}
              >
                <X className="size-3" />
              </button>
            </div>
          ) : null}

          {media.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {media.map((m) => (
                <div
                  key={m.id}
                  className="relative size-20 overflow-hidden rounded-lg border border-[var(--jq-border)]"
                >
                  {m.type === "VIDEO" ? (
                    <video
                      src={normalizeMediaUrl(m.url) ?? m.url}
                      className="size-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    <Image
                      src={normalizeMediaUrl(m.url) ?? m.url}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                    aria-label="Remover mídia"
                    onClick={() => setMedia((prev) => prev.filter((x) => x.id !== m.id))}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {linkPreview && !linkPreviewRemoved && !pollMode ? (
            <ComposerLinkPreview
              preview={linkPreview}
              onRemove={() => {
                setLinkPreviewRemoved(true);
                setLinkPreview(null);
              }}
            />
          ) : null}

          {threadBlocks.map((block, i) => (
            <div
              key={i}
              className="relative mt-3 border-l-2 border-[var(--jq-primary)]/40 pl-3"
            >
              <textarea
                rows={2}
                maxLength={JQ_COMPOSER_MAX_CHARS}
                placeholder={`Publicação ${i + 2} da thread`}
                className="w-full resize-none rounded-md border border-[var(--jq-border)] bg-[var(--jq-surface)] px-3 py-2 text-sm"
                value={block.content}
                onChange={(e) =>
                  setThreadBlocks((blocks) =>
                    blocks.map((b, j) => (j === i ? { ...b, content: e.target.value } : b)),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute -left-1 top-0 size-6"
                aria-label={`Remover bloco ${i + 2}`}
                onClick={() => setThreadBlocks((blocks) => blocks.filter((_, j) => j !== i))}
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[var(--jq-border)] pt-3">
        {renderToolbar()}
        {practiceArea ? (
          <span className="hidden max-w-[140px] truncate rounded-full border border-[var(--jq-primary)]/40 bg-[var(--jq-primary)]/10 px-2 py-0.5 text-xs text-[var(--jq-primary)] sm:inline">
            {practiceArea}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          {scheduledAt ? (
            <span className="text-xs text-[var(--jq-primary)]">
              {formatScheduledLabel(scheduledAt)}
            </span>
          ) : null}
          <span className={cnCount(remaining)} aria-live="polite">
            {remaining}
          </span>
          {showFullComposer ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-8 rounded-full transition-colors",
                draftSavedHint
                  ? "text-emerald-500 hover:text-emerald-500"
                  : "text-[var(--jq-muted)] hover:bg-[var(--jq-primary)]/15 hover:text-[var(--jq-primary)]",
              )}
              onClick={saveDraftManual}
              disabled={create.isPending}
              aria-label={draftSavedHint ? "Rascunho salvo" : "Salvar rascunho"}
              title={draftSavedHint ? "Rascunho salvo" : "Salvar rascunho"}
            >
              <Check className="size-5" strokeWidth={draftSavedHint ? 2.75 : 1.75} />
            </Button>
          ) : null}
          {showFullComposer ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full text-[var(--jq-muted)] hover:bg-[var(--jq-primary)]/15 hover:text-[var(--jq-primary)]"
                  aria-label="Configurações da publicação"
                  title="Configurações do post"
                >
                  <Settings2 className="size-5" strokeWidth={1.75} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 border-[var(--jq-border)] bg-[var(--jq-bg)] text-[var(--jq-text)]"
              >
                <DropdownMenuLabel>Configurações do post</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={isConfidential}
                  disabled={!!communityId}
                  onCheckedChange={setIsConfidential}
                  onSelect={(e) => e.preventDefault()}
                  title="Visível apenas para membros do seu escritório"
                >
                  <span className="flex items-center gap-2">
                    <Lock className="size-4" />
                    Sigilo profissional
                  </span>
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={allowGifReplies}
                  onCheckedChange={setAllowGifReplies}
                  onSelect={(e) => e.preventDefault()}
                >
                  Permitir GIF nas respostas
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Button
            type="button"
            disabled={!canPost}
            className="rounded-full bg-[var(--jq-primary)] font-bold text-[var(--jq-on-primary)] hover:bg-[var(--jq-primary)]/90"
            onClick={submit}
          >
            {scheduledAt
              ? "Agendar publicação"
              : hasThread
                ? "Publicar tudo"
                : parentId
                  ? "Responder"
                  : "Publicar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function cnCount(remaining: number) {
  const base = "text-xs tabular-nums";
  if (remaining < 0) return `${base} text-[var(--jq-like)]`;
  if (remaining < 40) return `${base} text-amber-600`;
  return `${base} text-[var(--jq-muted)]`;
}
