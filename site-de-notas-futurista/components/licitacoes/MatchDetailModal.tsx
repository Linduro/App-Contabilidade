import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatCurrency,
  formatDate,
  formatRelevancia,
  getLicitacaoCidade,
  getLicitacaoDeadline,
  getLicitacaoValor,
  getStatusLabel,
  parseCategories,
} from "@/lib/licitacoes/formatters";
import { normalizePncpPortalUrl } from "@/lib/licitacoes/pncp-url";
import type { Match } from "@/lib/licitacoes/types";

interface MatchDetailModalProps {
  match: Match | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkInscrito: (matchId: string) => Promise<void>;
  onArchive: (matchId: string) => Promise<void>;
  loading?: boolean;
}

export function MatchDetailModal({
  match,
  open,
  onOpenChange,
  onMarkInscrito,
  onArchive,
  loading = false,
}: MatchDetailModalProps) {
  if (!match) return null;

  const licitacao = match.licitacao;
  const categorias = [
    match.especialidade?.nome,
    ...parseCategories(match.motivo),
  ].filter(Boolean) as string[];

  const descricao =
    licitacao.descricao ??
    licitacao.objeto ??
    "Descrição não disponível para esta licitação.";

  const editalUrl = normalizePncpPortalUrl(licitacao.url_fonte);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8 text-xl leading-snug">
            {licitacao.titulo}
          </DialogTitle>
          <DialogDescription>
            {getLicitacaoCidade(licitacao)} · Prazo{" "}
            {formatDate(getLicitacaoDeadline(licitacao))} ·{" "}
            {formatCurrency(getLicitacaoValor(licitacao))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Descrição
            </h3>
            <p className="text-sm leading-relaxed text-foreground">{descricao}</p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Especialidades detectadas
            </h3>
            <div className="flex flex-wrap gap-2">
              {categorias.map((cat) => (
                <Badge key={cat} variant="secondary">
                  {cat}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Relevância:{" "}
              <span className="font-semibold text-emerald-700">
                {formatRelevancia(match.relevancia_score)}
              </span>
            </p>
          </section>

          <section className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Status atual:{" "}
              <span className="font-medium text-foreground">
                {getStatusLabel(match.status)}
              </span>
            </p>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" asChild>
            <a
              href={editalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              Ver edital no PNCP
            </a>
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={loading || match.status === "arquivado"}
              onClick={() => onArchive(match.id)}
            >
              Arquivar
            </Button>
            <Button
              disabled={loading || match.status === "inscrito"}
              onClick={() => onMarkInscrito(match.id)}
            >
              Marcar como inscrito
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
