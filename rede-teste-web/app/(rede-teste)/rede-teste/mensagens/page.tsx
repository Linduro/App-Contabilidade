import { Suspense } from "react";
import { MessagesView } from "@/components/rede-teste/mensagens/messages-view";

export const metadata = { title: "Mensagens — Rede Teste" };

export default function RedeTesteMensagensPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--jq-muted)]">Carregando…</p>}>
      <MessagesView />
    </Suspense>
  );
}
