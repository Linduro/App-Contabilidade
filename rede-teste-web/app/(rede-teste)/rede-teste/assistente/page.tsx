import { redirect } from "next/navigation";
import { EstagiarioWorkspace } from "@/components/rede-teste/ia/estagiario-workspace";
import { isRedeTesteIaEnabled } from "@/lib/platform-config";

export const metadata = {
  title: "Estagiário Artificial — Rede Teste",
  description:
    "Chat com Gemini usando somente as fontes que você anexar (cliente, processo, publicações e PDFs).",
};

export default function AssistenteIaPage() {
  if (!isRedeTesteIaEnabled()) {
    redirect("/rede-teste");
  }
  return <EstagiarioWorkspace />;
}
