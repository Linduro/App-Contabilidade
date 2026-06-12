"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const TOOLS = [
  {
    name: "ChatGPT",
    href: "https://chatgpt.com",
    description: "Redação de petições, contratos e revisão de textos jurídicos.",
    prompt:
      "Sou advogado(a) brasileiro(a). Ajude-me a redigir uma peça processual clara e fundamentada, com base na legislação e jurisprudência aplicáveis. Contexto do caso:",
  },
  {
    name: "Claude",
    href: "https://claude.ai",
    description: "Análise de documentos longos, minutas e argumentação estruturada.",
    prompt:
      "Atue como assistente jurídico para o Direito brasileiro. Elabore minuta de peça com fatos, direito e pedidos. Caso:",
  },
  {
    name: "Gemini",
    href: "https://gemini.google.com",
    description: "Pesquisa rápida, resumos e brainstorming de teses.",
    prompt:
      "Preciso de ajuda para estruturar uma peça jurídica no Brasil. Liste teses, pedidos e pontos de atenção para:",
  },
] as const;

export function AssistenteIaView() {
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
            <h1 className="text-xl font-bold">Assistente IA</h1>
            <p className="text-sm text-[var(--jq-muted)]">
              Ferramentas públicas recomendadas para peças e consultas jurídicas
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="rounded-2xl border border-[var(--jq-border)] bg-[var(--jq-surface)] p-4">
          <div className="flex gap-3">
            <Sparkles className="size-6 shrink-0 text-[var(--jq-primary)]" />
            <div className="text-sm text-[var(--jq-muted)]">
              <p>
                A IA jurídica integrada foi desativada. Use um dos assistentes abaixo (contas
                próprias). Sempre revise o texto antes de protocolar — a responsabilidade é do
                advogado.
              </p>
            </div>
          </div>
        </div>

        {TOOLS.map((tool) => (
          <article
            key={tool.name}
            className="rounded-2xl border border-[var(--jq-border)] bg-[var(--jq-surface)] p-4"
          >
            <h2 className="text-lg font-bold">{tool.name}</h2>
            <p className="mt-1 text-sm text-[var(--jq-muted)]">{tool.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                asChild
                className="rounded-full bg-[var(--jq-primary)] text-[var(--jq-on-primary)] hover:bg-[var(--jq-primary)]/90"
              >
                <a href={tool.href} target="_blank" rel="noopener noreferrer">
                  Abrir {tool.name}
                  <ExternalLink className="ml-2 size-4" />
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="jq-btn-outline rounded-full"
                onClick={() => {
                  const url = `${tool.href}?q=${encodeURIComponent(tool.prompt)}`;
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
              >
                Abrir com prompt jurídico
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
