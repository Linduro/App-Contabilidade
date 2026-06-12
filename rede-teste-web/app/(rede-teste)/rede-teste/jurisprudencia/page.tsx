import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { JurisSearchView } from "@/components/rede-teste/jurisprudencia/juris-search-view";

export const metadata = { title: "Jurisprudência — Rede Teste" };

export default function JurisprudenciaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-[var(--jq-muted)]" />
        </div>
      }
    >
      <JurisSearchView />
    </Suspense>
  );
}
