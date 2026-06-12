"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileUp,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { type assistantPrompt } from "@/lib/rede-teste/assistant-prompts";
import { buildassistantSyncPrompt } from "@/lib/rede-teste/assistant-sync-prompt";
import {
  createassistantBridgeSessionId,
  revokeassistantBridgeSession,
  sendassistantBridgeHeartbeat,
} from "@/lib/rede-teste/assistant-bridge-session-client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export function assistantWorkspace() {
  const workspace = trpc.redeTeste.assistantWorkspace.useQuery();
  const [promptId, setPromptId] = useState("inicial-peticao");
  const [selectedArea, setSelectedArea] = useState("");
  const [caseId, setCaseId] = useState("");
  const [clientId, setClientId] = useState("");
  const [entrega, setEntrega] = useState("");
  const [selectedBookmarks, setSelectedBookmarks] = useState<string[]>([]);
  const [uploadedPdfNames, setUploadedPdfNames] = useState<string[]>([]);
  const [uploadedPdfUrls, setUploadedPdfUrls] = useState<Array<{ name: string; url: string }>>([]);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [showAdvancedPrompts, setShowAdvancedPrompts] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState("");
  const [awaitingassistant, setAwaitingassistant] = useState(false);
  const [assistantProgress, setassistantProgress] = useState(12);
  const [robustModeEnabled, setRobustModeEnabled] = useState(true);
  const [diagnosticModeEnabled, setDiagnosticModeEnabled] = useState(false);
  const [pdfTransferMode, setPdfTransferMode] = useState<"auto" | "file" | "link">("auto");
  /** Após o primeiro "Solicitar", o caderno assistant existe e o chat fica visível. */
  const [sessionActive, setSessionActive] = useState(false);
  /** Usuário clicou em Solicitar — revela a área de mensagens (com loading depois). */
  const [setupRequested, setSetupRequested] = useState(false);
  const pendingSetupUserTextRef = useRef("");
  const bridgeSessionIdRef = useRef("");
  const pendingRevokeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!bridgeSessionIdRef.current) {
    bridgeSessionIdRef.current = createassistantBridgeSessionId();
  }

  const clients = trpc.clients.listForSelect.useQuery();
  const cases = trpc.cases.list.useQuery({ take: 50 });
  const bookmarks = trpc.redeTeste.listBookmarks.useQuery({ limit: 20 });

  const assistantChat = trpc.redeTeste.assistantChat.useMutation();
  const extensionInstallerUrl = "/downloads/instalar-extensao-juridiques.bat";
  const extensionChromeStoreZipUrl = "/downloads/rede-teste-assistant-chrome-store.zip";
  const extensionPrivacyUrl = "https://portal.com/privacidade-extensao-juridiques.html";

  useEffect(() => {
    if (pendingRevokeTimerRef.current) {
      clearTimeout(pendingRevokeTimerRef.current);
      pendingRevokeTimerRef.current = null;
    }
  }, []);

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
    if (!workspace.data?.prompts?.length) return;
    if (!promptId) {
      setPromptId(workspace.data.prompts[0].id);
    }
    if (!selectedArea) {
      setSelectedArea(workspace.data.prompts[0].area || "Geral");
    }
  }, [workspace.data, promptId, selectedArea]);

  useEffect(() => {
    function onExtensionMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.data?.type === "JQ_assistant_RESPONSE_READY") {
        const text = event.data?.payload?.text;
        const isError = event.data?.payload?.source === "error";
        if (!text) return;
        setAwaitingassistant(false);
        if (isError) {
          setSetupRequested(true);
          setChatMessages([{ role: "assistant", text }]);
        } else {
          setSessionActive(true);
          const setupUser = pendingSetupUserTextRef.current;
          if (setupUser) {
            pendingSetupUserTextRef.current = "";
            setChatMessages([
              { role: "user", text: setupUser },
              { role: "assistant", text },
            ]);
          } else {
            setChatMessages((prev) => [...prev, { role: "assistant", text }]);
          }
        }
        setExtensionStatus("Resposta recebida do assistant.");
      }
      if (event.data?.type === "JQ_assistant_STATUS") {
        const status = event.data?.payload?.status as string | undefined;
        const message = event.data?.payload?.message as string | undefined;
        const needsPageReload = !!event.data?.payload?.needsPageReload;
        if (message) setExtensionStatus(message);
        if (status === "session-ready") {
          setSessionActive(true);
        }
        if (
          status === "sync-failed" ||
          status === "sync-complete" ||
          status === "sync-awaiting-manual" ||
          status === "manual-response-empty"
        ) {
          setAwaitingassistant(false);
          if (status === "sync-complete") setSessionActive(true);
        }
        if (needsPageReload) {
          toast.error("Recarregue esta página (F5) após atualizar a extensão no Chrome.");
        }
        if (status === "sync-failed" && message) {
          toast.error(message);
        }
      }
    }

    window.addEventListener("message", onExtensionMessage);
    return () => window.removeEventListener("message", onExtensionMessage);
  }, []);

  useEffect(() => {
    if (!awaitingassistant) {
      setassistantProgress(12);
      return;
    }
    let value = 12;
    let direction = 1;
    const timer = window.setInterval(() => {
      value += direction * 7;
      if (value >= 88) direction = -1;
      if (value <= 12) direction = 1;
      setassistantProgress(value);
    }, 140);
    return () => window.clearInterval(timer);
  }, [awaitingassistant]);

  const selectedPrompt = workspace.data?.prompts.find((p) => p.id === promptId);
  const promptsByArea = useMemo(
    () =>
      (workspace.data?.prompts ?? []).reduce<Record<string, assistantPrompt[]>>(
        (acc, prompt) => {
          const area = prompt.area || "Geral";
          if (!acc[area]) acc[area] = [];
          acc[area].push(prompt);
          return acc;
        },
        {},
      ),
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
  const promptsInSelectedAreaRaw = selectedArea ? sortedPromptsByArea[selectedArea] ?? [] : [];
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
      const uploaded: Array<{ name: string; url: string }> = [];
      for (const file of pdfs) {
        const form = new FormData();
        form.append("file", file);
        form.append("sessionId", bridgeSessionIdRef.current);
        const res = await fetch("/api/rede-teste/assistant-pdf", {
          method: "POST",
          body: form,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          name?: string;
          error?: string;
        };
        if (!res.ok || !data.url) {
          const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
          let hint = data.error;
          if (!hint && res.status === 413) {
            hint = `PDF muito grande (${sizeMb} MB). Máximo: 25 MB.`;
          }
          if (!hint && res.status === 401) {
            hint = "Sessão expirada — faça login novamente.";
          }
          if (!hint && res.status >= 500) {
            hint = "Erro no servidor ao gravar o PDF. Tente de novo em instantes.";
          }
          throw new Error(hint || `Falha ao enviar ${file.name} (${res.status})`);
        }
        uploaded.push({ name: data.name || file.name, url: data.url });
        void fetch(data.url, { method: "GET", cache: "force-cache" }).catch(() => {});
      }
      setUploadedPdfUrls((prev) => {
        const map = new Map(prev.map((item) => [item.name, item]));
        for (const item of uploaded) map.set(item.name, item);
        return Array.from(map.values());
      });
      setUploadedPdfNames((prev) =>
        Array.from(new Set([...prev, ...uploaded.map((f) => f.name)])),
      );
      toast.success(
        `${uploaded.length} PDF(s) prontos — o link vale enquanto esta janela estiver aberta`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar PDF");
    } finally {
      setPdfUploading(false);
    }
  }

  function postExtensionSync(
    syncPhase: "setup" | "message",
    text: string,
    options?: { includeContext?: boolean },
  ) {
    const selectedClient = clients.data?.find((c) => c.id === clientId);
    const selectedCase = cases.data?.items.find((c) => c.id === caseId);
    const includeContext = options?.includeContext ?? syncPhase === "setup";

    window.postMessage(
      {
        type: "JQ_assistant_START_SYNC",
        payload: {
          syncPhase,
          message: text,
          mode: robustModeEnabled ? "robust" : "strict",
          diagnosticMode: diagnosticModeEnabled,
          pdfTransferMode,
          ...(includeContext
            ? {
                selectedPromptTitle: selectedPrompt?.title ?? null,
                selectedArea: selectedArea || selectedPrompt?.area || null,
                selectedPromptDescription: selectedPrompt?.description ?? null,
                clientName: selectedClient?.name ?? null,
                caseLabel: selectedCase?.cnjNumber ?? null,
                bookmarksSummary: `${selectedBookmarks.length} fonte(s)`,
                bookmarkSnippets: (bookmarks.data?.items ?? [])
                  .filter((b) => selectedBookmarks.includes(b.id))
                  .map((b) => (b.content || "").trim())
                  .filter(Boolean),
                bookmarkIds: selectedBookmarks,
                pdfUrls: uploadedPdfUrls,
                pdfNames: uploadedPdfNames,
              }
            : {}),
        },
      },
      "*",
    );
  }

  function buildInitialassistantCommand() {
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

  async function solicitarInicial() {
    if (!selectedPrompt) {
      toast.error("Escolha o tipo de peça antes de solicitar");
      return;
    }
    if (pdfUploading) {
      toast.error("Aguarde o envio do PDF ao servidor terminar");
      return;
    }
    if (uploadedPdfNames.length && !uploadedPdfUrls.length) {
      toast.error("Reanexe o PDF — o link temporário não foi gerado");
      return;
    }
    const command = buildInitialassistantCommand();
    pendingSetupUserTextRef.current = `Peça solicitada: ${selectedPrompt.title}`;
    setSetupRequested(true);
    setAwaitingassistant(true);
    setExtensionStatus("Criando caderno e enviando o comando padrão ao assistant…");
    postExtensionSync("setup", command, { includeContext: true });
    void assistantChat
      .mutateAsync({
        message: command,
        promptId,
        clientId: clientId || undefined,
        caseId: caseId || undefined,
        bookmarkPublicationIds: selectedBookmarks.length ? selectedBookmarks : undefined,
        localPdfNames: uploadedPdfNames.length ? uploadedPdfNames : undefined,
      })
      .catch(() => {});
  }

  async function enviarMensagem() {
    const text = entrega.trim();
    if (!text || !sessionActive) return;
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setEntrega("");
    setAwaitingassistant(true);
    setExtensionStatus("Enviando ao assistant…");
    postExtensionSync("message", text, { includeContext: false });
  }

  const setupOptionsRow = (
    <>
      <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--jq-muted)]">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={robustModeEnabled}
            onChange={(e) => setRobustModeEnabled(e.target.checked)}
          />
          Modo robusto (assistido)
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={diagnosticModeEnabled}
            onChange={(e) => setDiagnosticModeEnabled(e.target.checked)}
          />
          Modo diagnóstico
        </label>
        <label className="inline-flex items-center gap-2">
          Envio do PDF:
          <select
            className="rounded border border-[var(--jq-border)] bg-[var(--jq-surface)] px-2 py-1 text-[var(--jq-text)]"
            value={pdfTransferMode}
            onChange={(e) => setPdfTransferMode(e.target.value as "auto" | "file" | "link")}
          >
            <option value="auto">Automático (arquivo → link)</option>
            <option value="file">Só upload de arquivo</option>
            <option value="link">Só link (website)</option>
          </select>
        </label>
      </div>
      {extensionStatus && !awaitingassistant ? (
        <p className="text-xs text-[var(--jq-muted)]">{extensionStatus}</p>
      ) : null}
      {selectedBookmarks.length || uploadedPdfNames.length ? (
        <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <Sparkles className="size-3.5" />
          Contexto pronto: {selectedBookmarks.length} fonte(s) do SaaS e {uploadedPdfNames.length}{" "}
          PDF(s) local(is).
        </p>
      ) : null}
    </>
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
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="size-5 text-[var(--jq-primary)]" />
              Estagiário Artificial
            </h1>
            <p className="mt-1 text-[11px] text-[var(--jq-text)] opacity-70">
              Extensão v2.1+ (assistant + Jusbrasil). Instale ou recarregue em{" "}
              <code className="text-[10px]">chrome://extensions</code> após baixar.
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <a href={extensionInstallerUrl} download>
                <Download className="mr-2 size-4" />
                Instalar extensão
              </a>
            </Button>
            <Button asChild size="sm" variant="ghost" className="rounded-full text-xs">
              <a href={extensionChromeStoreZipUrl} download>
                ZIP (loja)
              </a>
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-5 p-4 max-w-3xl mx-auto">
        <details className="rounded-xl border border-[var(--jq-border)]" open={!sessionActive}>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold hover:bg-[var(--jq-surface)]">
            1. Escolher tipo de peça
          </summary>
          <section className="space-y-3 border-t border-[var(--jq-border)] p-4">
            <p className="text-xs text-[var(--jq-muted)]">
              Clique em uma área e selecione a peça ao lado. Isso evita uma lista única muito longa.
            </p>
            <div>
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
                        className={`w-full rounded-md px-3 py-2 text-left text-xs transition ${
                          selectedArea === area
                            ? "bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
                            : "bg-[var(--jq-surface)] text-[var(--jq-muted)] hover:text-[var(--jq-text)]"
                        }`}
                      >
                        {area}
                      </button>
                    ))}
                  </div>
                </aside>

                <aside className="max-h-64 overflow-y-auto rounded-lg border border-[var(--jq-border)] p-2">
                  <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--jq-muted)]">
                    Peças de {selectedArea || "área"}
                  </p>
                  <div className="mb-2 flex justify-end px-2">
                    <button
                      type="button"
                      className="text-[11px] font-medium text-[var(--jq-primary)] hover:underline"
                      onClick={() => setShowAdvancedPrompts((v) => !v)}
                    >
                      {showAdvancedPrompts ? "Mostrar essenciais" : "Mostrar todos"}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {promptsInSelectedArea.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPromptId(p.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left transition ${
                          promptId === p.id
                            ? "border-[var(--jq-primary)] bg-[var(--jq-primary)]/15 text-[var(--jq-text)]"
                            : "border-[var(--jq-border)] bg-[var(--jq-surface)] text-[var(--jq-muted)] hover:text-[var(--jq-text)]"
                        }`}
                      >
                        <p className="text-sm font-semibold">{p.title}</p>
                      </button>
                    ))}
                  </div>
                </aside>
              </div>
              {selectedPrompt ? (
                <p className="mt-1 text-xs text-[var(--jq-muted)]">{selectedPrompt.description}</p>
              ) : null}
            </div>
          </section>
        </details>

        <details className="rounded-xl border border-[var(--jq-border)]" open={!sessionActive}>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold hover:bg-[var(--jq-surface)]">
            2. Contexto e fontes
          </summary>
          <section className="space-y-3 border-t border-[var(--jq-border)] p-4">
            <p className="text-xs text-[var(--jq-muted)]">
              Este chat usará fontes do seu SaaS e PDFs locais como base documental para respostas da IA.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Cliente (opcional)</Label>
              <Select value={clientId || "_none"} onValueChange={(v) => setClientId(v === "_none" ? "" : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {clients.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Processo (opcional)</Label>
              <Select value={caseId || "_none"} onValueChange={(v) => setCaseId(v === "_none" ? "" : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {cases.data?.items.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.cnjNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <details className="rounded-md border border-[var(--jq-border)] bg-[var(--jq-surface)]">
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-[var(--jq-text)]">
                  Modelos/fontes salvas no SaaS
                </summary>
                <div className="max-h-44 space-y-2 overflow-y-auto border-t border-[var(--jq-border)] p-2">
                  {bookmarks.data?.items?.length ? (
                    bookmarks.data.items.map((item) => {
                      const checked = selectedBookmarks.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-[var(--jq-surface)]"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              setSelectedBookmarks((prev) =>
                                v ? [...prev, item.id] : prev.filter((id) => id !== item.id),
                              );
                            }}
                          />
                          <span className="line-clamp-2 text-xs text-[var(--jq-muted)]">
                            {item.content || "Publicação sem conteúdo"}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-xs text-[var(--jq-muted)]">
                      Nenhuma publicação salva encontrada.
                    </p>
                  )}
                </div>
              </details>
            </div>

            <div>
              <details className="rounded-md border border-[var(--jq-border)] bg-[var(--jq-surface)]">
                <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-[var(--jq-text)]">
                  PDF do computador
                  <span className="ml-1 text-xs font-normal text-[var(--jq-muted)]">
                    (link só com esta aba aberta)
                  </span>
                </summary>
                <div className="border-t border-[var(--jq-border)] p-2">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--jq-border)] p-4 text-xs text-[var(--jq-muted)] hover:bg-[var(--jq-surface)]">
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
                  <div className="mt-2 max-h-28 overflow-y-auto rounded-lg border border-[var(--jq-border)] p-2">
                    {uploadedPdfNames.length ? (
                      <ul className="space-y-1 text-xs text-[var(--jq-muted)]">
                        {uploadedPdfNames.map((name) => (
                          <li key={name}>- {name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[var(--jq-muted)]">Nenhum PDF local selecionado.</p>
                    )}
                    {pdfUploading ? (
                      <p className="mt-2 text-xs text-amber-700">Enviando PDF ao servidor…</p>
                    ) : null}
                  </div>
                </div>
              </details>
            </div>

          </div>
          </section>
        </details>

        {!setupRequested ? (
          <section className="rounded-xl border border-[var(--jq-border)] p-4 space-y-3">
            <h2 className="font-semibold text-sm">3. Iniciar</h2>
            <p className="text-xs text-[var(--jq-muted)]">
              Escolha a peça e as fontes acima. O primeiro envio ao assistant usa o{" "}
              <strong>comando padrão</strong> da peça selecionada — você não precisa digitar nada ainda.
            </p>
            {selectedPrompt ? (
              <div className="rounded-lg border border-[var(--jq-border)] bg-[var(--jq-surface)] px-3 py-2.5">
                <p className="text-xs font-semibold text-[var(--jq-text)]">{selectedPrompt.title}</p>
                <p className="mt-1 text-[11px] text-[var(--jq-muted)]">{selectedPrompt.description}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!selectedPrompt || awaitingassistant}
                onClick={() => void solicitarInicial()}
              >
                <Sparkles className="mr-2 size-4" />
                Solicitar
              </Button>
            </div>
            {setupOptionsRow}
          </section>
        ) : (
          <section className="rounded-xl border border-[var(--jq-border)] p-4 space-y-3">
            <h2 className="font-semibold text-sm">Chat do Estagiário Artificial</h2>
            {sessionActive ? (
              <p className="text-xs text-[var(--jq-muted)]">
                Caderno ativo. <strong>Enviar</strong> manda só sua nova mensagem — sem recriar caderno
                nem reenviar PDFs.
              </p>
            ) : (
              <p className="text-xs text-[var(--jq-muted)]">
                Preparando o caderno e aguardando a primeira resposta do assistant…
              </p>
            )}
            <div className="min-h-[320px] space-y-2 overflow-y-auto rounded-lg border border-[var(--jq-border)] p-3">
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
                  <p>{m.text}</p>
                </div>
              ))}
              {awaitingassistant ? (
                <div className="mr-8 space-y-2 rounded-lg bg-[var(--jq-surface)] px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--jq-muted)]">
                    Estagiário Artificial
                  </p>
                  <Progress value={assistantProgress} className="h-1.5 bg-[var(--jq-border)]" />
                  <p className="text-xs text-[var(--jq-muted)]">
                    {extensionStatus || "Aguardando resposta do assistant…"}
                  </p>
                </div>
              ) : null}
              {!chatMessages.length && !awaitingassistant ? (
                <div className="flex min-h-[200px] items-center justify-center text-xs text-[var(--jq-muted)]">
                  A conversa aparecerá aqui.
                </div>
              ) : null}
            </div>
            <Textarea
              className="min-h-[160px] text-base"
              placeholder={
                sessionActive
                  ? "Digite sua mensagem para o caderno já criado…"
                  : "Aguardando a primeira resposta do assistant…"
              }
              value={entrega}
              onChange={(e) => setEntrega(e.target.value)}
              disabled={!sessionActive || awaitingassistant}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!sessionActive || !entrega.trim() || awaitingassistant}
                onClick={() => void enviarMensagem()}
              >
                <MessageSquare className="mr-2 size-4" />
                {awaitingassistant ? "Aguardando…" : "Enviar"}
              </Button>
              {sessionActive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={awaitingassistant}
                  onClick={() => {
                    setEntrega("");
                    toast.message("Mensagem limpa");
                  }}
                >
                  Limpar
                </Button>
              ) : null}
            </div>
            {setupOptionsRow}
          </section>
        )}
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
