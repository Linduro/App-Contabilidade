import { Suspense } from "react";
import { ExploreView } from "@/components/rede-teste/explorar/explore-view";
import { Loader2 } from "lucide-react";

export const metadata = { title: "Explorar — Rede Teste" };

export default function RedeTesteExplorarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-[var(--jq-muted)]" />
        </div>
      }
    >
      <ExploreView />
    </Suspense>
  );
}
