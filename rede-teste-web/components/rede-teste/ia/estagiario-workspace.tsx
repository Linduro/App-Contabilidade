"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, FileUp, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { type assistantPrompt } from "@/lib/rede-teste/assistant-prompts";
import { buildassistantSyncPrompt } from "@/lib/rede-teste/assistant-sync-prompt";
import { clearJqEstagiarioContext, loadJqEstagiarioContext } from "@/lib/templates/rede-teste-bridge";
import {
  createassistantBridgeSessionId,
  revokeassistantBridgeSession,
  sendassistantBridgeHeartbeat,
} from "@/lib/rede-teste/assistant-bridge-session-client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export function EstagiarioWorkspace() {
  const workspace = trpc.redeTeste.assistantWorkspace.useQuery();
  const [promptId, setPromptId] = useState("inicial-peticao");
  const [selectedArea, setSelectedArea] = useState("");
  const [caseId, setCaseId] = useState("");
  const [clientId, setClientId] = useState("");
  const [entrega, setEntrega] = useState("");
  const [documentContextText, setDocumentContextText] = useState<string | undefined>();
  const [selectedBookmarks, setSelectedBookmarks] = useState<string[]>([]);
  const [uploadedPdfNames, setUploadedPdfNames] = useState<string[]>([]);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([]);
  const [showAdvancedPrompts, setShowAdvancedPrompts] = useState(false);
  const [chatStatus, setChatStatus] = useState("");
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [progress, setProgress] = useState(12);

  const bridgeSessionIdRef = useRef("");
  const pendingRevokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!bridgeSessionIdRef.current) {
    bridgeSessionIdRef.current = createassistantBridgeSessionId();
  }

  const clients = trpc.clients.listForSelect.useQuery();
  const cases = trpc.cases.list.useQuery({ take: 50 });
  const bookmarks = trpc.redeTeste.listBookmarks.useQuery({ limit: 20 });
  const chatMutation = trpc.redeTeste.assistantChat.useMutation();

  const geminiReady = workspace.data?.geminiConfigured ?? false;
  const chatStarted = chatMessages.length > 0;

  useEffect(() => {
    const sessionId = bridgeSessionIdRef.current;
    sendassistantBridgeHeartbeat(sessionId);
    const heartbeatTimer = window.setInterval(
      () => sendassistantBridgeHeartbeat(sessionId),
      20_000,
    );
    const onPageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) revokeassistantBridgeSession(sessionId, { beacon: true });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(heartbeatTimer);
      pendingRevokeTimerRef.current = window.setTimeout(() => {
        revokeassistantBridgeSession(sessionId);
      }, 2000);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((u: { id?: string } | null) => {
        if (cancelled || !u?.id) return;
        const ctx = loadJqEstagiarioContext(u.id);
        if (!ctx?.documentText) return;
        setDocumentContextText(ctx.documentText.slice(0, 50_000));
        setEntrega(
          `Use o documento do modelo "${ctx.templateTitle ?? "documento"}" nas fontes abaixo para responder.`,
        );
        clearJqEstagiarioContext(u.id);
        toast.message("Documento do Portal carregado como fonte do Estagiário.");
        void fetch("/api/rede-teste/estagiario/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentText: ctx.documentText.slice(0, 50_000),
            templateId: ctx.templateId,
            templateTitle: ctx.templateTitle,
          }),
        }).catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspace.data?.prompts?.length) return;
    if (!promptId) setPromptId(workspace.data.prompts[0].id);
    if (!selectedArea) setSelectedArea(workspace.data.prompts[0].area || "Geral");
  }, [workspace.data, promptId, selectedArea]);

  useEffect(() => {
    if (!awaitingReply) {
      setProgress(12);
      return;
    }
    let value = 12;
    let direction = 1;
    const timer = window.setInterval(() => {
      value += direction * 7;
      if (value >= 88) direction = -1;
      if (value <= 12) direction = 1;
      setProgress(value);
    }, 140);
    return () => window.clearInterval(timer);
  }, [awaitingReply]);

  const selectedPrompt = workspace.data?.prompts.find((p) => p.id === promptId);
  const promptsByArea = useMemo(
    () =>
      (workspace.data?.prompts ?? []).reduce<Record<string, assistantPrompt[]>>((acc, prompt) => {
        const area = prompt.area || "Geral";
        if (!acc[area]) acc[area] = [];
        acc[area].push(prompt);
        return acc;
      }, {}),
    [workspace.data?.prompts],
  );
  const sortedPromptsByArea = useMemo(() => {
    const next: Record<string, assistantPrompt[]> = {};
    for (const [area, prompts] of Object.entries(promptsByArea)) {
      next[area] = [...prompts].sort((a, b) => {
        const delta = getPromptPriorityScore(a.title) - getPromptPriorityScore(b.title);
        if (delta !== 0) return delta;
        return a.title.localeCompare(b.title, "pt-BR");
      });
    }
    return next;
  }, [promptsByArea]);
  const orderedAreas = useMemo(
    () => Object.keys(sortedPromptsByArea).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [sortedPromptsByArea],
  );
  const promptsInSelectedAreaRaw = selectedArea ? (sortedPromptsByArea[selectedArea] ?? []) : [];
  const promptsInSelectedArea = useMemo(() => {
    if (showAdvancedPrompts) return promptsInSelectedAreaRaw;
    const essentials = promptsInSelectedAreaRaw.filter((p) => !isAdvancedPrompt(p.title));
    return essentials.length ? essentials : promptsInSelectedAreaRaw;
  }, [promptsInSelectedAreaRaw, showAdvancedPrompts]);

  async function onSelectLocalPdfs(files: FileList | null) {
    if (!files?.length) return;
    const pdfs = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (!pdfs.length) {
      toast.error("Selecione apenas arquivos PDF");
      return;
    }
    setPdfUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of pdfs) {
        const form = new FormData();
        form.append("file", file);
        form.append("sessionId", bridgeSessionIdRef.current);
        const res = await fetch("/api/rede-teste/assistant-pdf", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { name?: string; error?: string };
        if (!res.ok) {
          const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
          let hint = data.error;
          if (!hint && res.status === 413) hint = `PDF muito grande (${sizeMb} MB). Máximo: 25 MB.`;
          if (!hint && res.status === 401) hint = "Sessão expirada — faça login novamente.";
          throw new Error(hint || `Falha ao enviar ${file.name}`);
        }
        uploaded.push(data.name || file.name);
      }
      setUploadedPdfNames((prev) => Array.from(new Set([...prev, ...uploaded])));
      toast.success(`${uploaded.length} PDF(s) anexado(s) como fonte`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar PDF");
    } finally {
      setPdfUploading(false);
    }
  }

  function buildInitialCommand() {
    const selectedClient = clients.data?.find((c) => c.id === clientId);
    const selectedCase = cases.data?.items.find((c) => c.id === caseId);
    return buildassistantSyncPrompt({
      selectedPromptTitle: selectedPrompt?.title ?? null,
      selectedArea: selectedArea || selectedPrompt?.area || null,
      clientName: selectedClient?.name ?? null,
      caseLabel: selectedCase?.cnjNumber ?? null,
      bookmarkSnippets: (bookmarks.data?.items ?? [])
        .filter((b) => selectedBookmarks.includes(b.id))
        .map((b) => (b.content || "").trim())
        .filter(Boolean),
      pdfNames: uploadedPdfNames,
    });
  }

  async function sendToGemini(userMessage: string, displayInChat?: { role: "user"; text: string }) {
    if (!geminiReady) {
      toast.error("Gemini não configurado no servidor (GEMINI_API_KEY).");
      return;
    }
    if (!userMessage.trim()) return;

    const history = displayInChat
      ? chatMessages
      : [...chatMessages, ...(displayInChat ? [displayInChat] : [])];

    if (displayInChat) {
      setChatMessages((prev) => [...prev, displayInChat]);
    }

    setAwaitingReply(true);
    setChatStatus("Consultando o Gemini com as fontes selecionadas…");

    try {
      const result = await chatMutation.mutateAsync({
        message: userMessage,
        promptId,
        clientId: clientId || undefined,
        caseId: caseId || undefined,
        bookmarkPublicationIds: selectedBookmarks.length ? selectedBookmarks : undefined,
        bridgeSessionId: bridgeSessionIdRef.current,
        documentContextText,
        history,
      });
      setChatMessages((prev) => [...prev, { role: "assistant", text: result.answer }]);
      setChatStatus("");
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message.replace(/\[GoogleGenerativeAI Error\]:?\s*/i, "").slice(0, 500)
          : "Falha ao obter resposta.";
      toast.error(msg, { duration: 12_000 });
      setChatStatus("");
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Não foi possível concluir: ${msg}`,
        },
      ]);
    } finally {
      setAwaitingReply(false);
    }
  }

  async function solicitarInicial() {
    if (!selectedPrompt) {
      toast.error("Escolha o tipo de peça antes de solicitar");
      return;
    }
    if (pdfUploading) {
      toast.error("Aguarde o envio do PDF terminar");
      return;
    }
    const command = buildInitialCommand();
    await sendToGemini(command, {
      role: "user",
      text: `Peça solicitada: ${selectedPrompt.title}`,
    });
  }

  async function enviarMensagem() {
    const text = entrega.trim();
    if (!text || awaitingReply) return;
    setEntrega("");
    await sendToGemini(text, { role: "user", text });
  }

  const sourcesHint =
    selectedBookmarks.length || uploadedPdfNames.length || clientId || caseId ? (
      <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Sparkles className="size-3.5" />
        Fontes: {selectedBookmarks.length} publicação(ões), {uploadedPdfNames.length} PDF(s)
        {clientId ? ", cliente" : ""}
        {caseId ? ", processo" : ""}
        {documentContextText ? ", documento Portal" : ""}.
      </p>
    ) : (
      <p className="text-xs text-[var(--jq-muted)]">
        Anexe PDFs ou selecione fontes — o modelo só usa o que você colocar aqui.
      </p>
    );

  return (
    <div className="min-h-full border-x border-[var(--jq-border)]">
      <header className="sticky top-0 z-10 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/rede-teste"
            className="rounded-full p-2 hover:bg-[var(--jq-surface)]"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="size-5 text-[var(--jq-primary)]" />
              Estagiário Artificial
            </h1>
            <p className="mt-1 text-[11px] text-[var(--jq-text)] opacity-70">
              Chat com Gemini — responde somente com base nas fontes que você anexar abaixo.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href="/modelos">
              <FileText className="mr-1 size-4" />
              Gerar a partir de modelo
            </Link>
          </Button>
        </div>
        {!geminiReady ? (
          <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            Configure <code className="text-[10px]">GEMINI_API_KEY</code> no servidor para ativar o
            chat.
          </p>
        ) : null}
      </header>

      <div className="space-y-5 p-4 max-w-3xl mx-auto">
        <details className="rounded-xl border border-[var(--jq-border)]" open={!chatStarted}>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold hover:bg-[var(--jq-surface)]">
            1. Escolher tipo de peça
          </summary>
          <section className="space-y-3 border-t border-[var(--jq-border)] p-4">
            <p className="text-xs text-[var(--jq-muted)]">
              Clique em uma área e selecione a peça. O primeiro envio usa o comando padrão da peça.
            </p>
            <div className="mt-2 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="max-h-64 overflow-y-auto rounded-lg border border-[var(--jq-border)] p-2">
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--jq-muted)]">
                  Áreas
                </p>
                <div className="space-y-1">
                  {orderedAreas.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() => {
                        setSelectedArea(area);
                        const first = sortedPromptsByArea[area]?.[0];
                        if (first) setPromptId(first.id);
                      }}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                        selectedArea === area
                          ? "bg-[var(--jq-primary)]/20 font-semibold"
                          : "hover:bg-[var(--jq-surface)]"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </aside>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--jq-border)] p-2">
                <label className="mb-2 flex items-center gap-2 px-1 text-[11px] text-[var(--jq-muted)]">
                  <input
                    type="checkbox"
                    checked={showAdvancedPrompts}
                    onChange={(e) => setShowAdvancedPrompts(e.target.checked)}
                  />
                  Mostrar peças avançadas
                </label>
                <div className="space-y-1">
                  {promptsInSelectedArea.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPromptId(p.id)}
                      className={`w-full rounded-md px-2 py-2 text-left text-xs ${
                        promptId === p.id
                          ? "border border-[var(--jq-primary)] bg-[var(--jq-primary)]/10"
                          : "hover:bg-[var(--jq-surface)]"
                      }`}
                    >
                      <span className="font-medium">{p.title}</span>
                      <span className="mt-0.5 block text-[10px] text-[var(--jq-muted)]">
                        {p.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </details>

        <details className="rounded-xl border border-[var(--jq-border)]" open={!chatStarted}>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold hover:bg-[var(--jq-surface)]">
            2. Fontes e contexto
          </summary>
          <section className="space-y-4 border-t border-[var(--jq-border)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Cliente (opcional)</Label>
                <Select value={clientId || "_none"} onValueChange={(v) => setClientId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {(clients.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Processo (opcional)</Label>
                <Select value={caseId || "_none"} onValueChange={(v) => setCaseId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {(cases.data?.items ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.cnjNumber} — {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <details className="rounded-md border border-[var(--jq-border)] bg-[var(--jq-surface)]">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">
                Publicações salvas no Rede Teste
              </summary>
              <div className="max-h-40 overflow-y-auto border-t border-[var(--jq-border)] p-2">
                {(bookmarks.data?.items ?? []).length ? (
                  bookmarks.data?.items.map((b) => (
                    <label
                      key={b.id}
                      className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-[var(--jq-bg)]"
                    >
                      <Checkbox
                        checked={selectedBookmarks.includes(b.id)}
                        onCheckedChange={(checked) => {
                          setSelectedBookmarks((prev) =>
                            checked ? [...prev, b.id] : prev.filter((id) => id !== b.id),
                          );
                        }}
                      />
                      <span className="line-clamp-2">{(b.content || "").slice(0, 120)}…</span>
                    </label>
                  ))
                ) : (
                  <p className="text-xs text-[var(--jq-muted)]">Nenhuma publicação salva.</p>
                )}
              </div>
            </details>

            <details className="rounded-md border border-[var(--jq-border)] bg-[var(--jq-surface)]">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">
                PDF do computador
              </summary>
              <div className="border-t border-[var(--jq-border)] p-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--jq-border)] p-4 text-xs text-[var(--jq-muted)]">
                  <FileUp className="size-4" />
                  Selecionar PDF(s)
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    className="hidden"
                    disabled={pdfUploading}
                    onChange={(e) => void onSelectLocalPdfs(e.target.files)}
                  />
                </label>
                {uploadedPdfNames.length ? (
                  <ul className="mt-2 space-y-1 text-xs text-[var(--jq-muted)]">
                    {uploadedPdfNames.map((name) => (
                      <li key={name}>• {name}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
            {sourcesHint}
          </section>
        </details>

        <section className="rounded-xl border border-[var(--jq-border)] p-4 space-y-3">
          <h2 className="font-semibold text-sm">Chat</h2>
          <p className="text-xs text-[var(--jq-muted)]">
            Use <strong>Solicitar</strong> para a primeira peça ou digite abaixo. O assistente não
            usa internet — apenas suas fontes.
          </p>
          {sourcesHint}

          <div className="min-h-[280px] space-y-2 overflow-y-auto rounded-lg border border-[var(--jq-border)] p-3">
            {chatMessages.map((m, idx) => (
              <div
                key={`${m.role}-${idx}`}
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-8 bg-[var(--jq-primary)]/15 text-[var(--jq-text)]"
                    : "mr-8 bg-[var(--jq-surface)] text-[var(--jq-muted)]"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-80">
                  {m.role === "user" ? "Você" : "Estagiário Artificial"}
                </p>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            ))}
            {awaitingReply ? (
              <div className="mr-8 space-y-2 rounded-lg bg-[var(--jq-surface)] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--jq-muted)]">
                  Estagiário Artificial
                </p>
                <Progress value={progress} className="h-1.5 bg-[var(--jq-border)]" />
                <p className="text-xs text-[var(--jq-muted)]">
                  {chatStatus || "Gerando resposta…"}
                </p>
              </div>
            ) : null}
            {!chatMessages.length && !awaitingReply ? (
              <div className="flex min-h-[160px] items-center justify-center text-xs text-[var(--jq-muted)]">
                A conversa aparecerá aqui.
              </div>
            ) : null}
          </div>

          <Textarea
            className="min-h-[120px] text-base"
            placeholder="Digite instruções, dúvidas ou pedidos de ajuste na peça…"
            value={entrega}
            onChange={(e) => setEntrega(e.target.value)}
            disabled={awaitingReply || !geminiReady}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void enviarMensagem();
              }
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!selectedPrompt || awaitingReply || pdfUploading || !geminiReady}
              onClick={() => void solicitarInicial()}
            >
              <Sparkles className="mr-2 size-4" />
              Solicitar peça
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={!entrega.trim() || awaitingReply || !geminiReady}
              onClick={() => void enviarMensagem()}
            >
              <MessageSquare className="mr-2 size-4" />
              {awaitingReply ? "Aguardando…" : "Enviar"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function getPromptPriorityScore(title: string): number {
  const t = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\b(peticao inicial|inicial|contestacao|replica|manifestacao|alegacoes finais|memoriais)\b/.test(t))
    return 0;
  if (/\b(recurso|apelacao|agravo|embargos de declaracao|contrarrazoes|contraminuta)\b/.test(t))
    return 1;
  if (/\b(cumprimento de sentenca|execucao|notificacao|acordo|contrato|parecer|memorando)\b/.test(t))
    return 2;
  if (
    /\b(incidente|uniformizacao|embargos de divergencia|autofalencia|detracao|remicao|carta testemunhavel|classificacao)\b/.test(
      t,
    )
  )
    return 4;
  return 3;
}

function isAdvancedPrompt(title: string): boolean {
  const t = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(incidente|uniformizacao|embargos de divergencia|autofalencia|detracao|remicao|carta testemunhavel|classificacao|pre-executividade)\b/.test(
    t,
  );
}
