import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCurrency,
  formatDate,
  formatRelevancia,
  getLicitacaoCidade,
  getLicitacaoDeadline,
  getLicitacaoValor,
  truncate,
} from "@/lib/licitacoes/formatters";
import type { Match, MatchFilters, MatchStatus } from "@/lib/licitacoes/types";

interface MatchesTableProps {
  matches: Match[];
  filters: MatchFilters;
  onSelect: (match: Match) => void;
}

function statusVariant(
  status: MatchStatus,
): "novo" | "visto" | "inscrito" | "secondary" {
  if (status === "novo") return "novo";
  if (status === "visto") return "visto";
  if (status === "inscrito") return "inscrito";
  return "secondary";
}

function applyFilters(matches: Match[], filters: MatchFilters): Match[] {
  return matches.filter((match) => {
    if (
      filters.especialidadeId !== "all" &&
      match.especialidade_id !== filters.especialidadeId
    ) {
      return false;
    }

    const valor = getLicitacaoValor(match.licitacao);
    const min = filters.valorMin ? parseFloat(filters.valorMin) : null;
    const max = filters.valorMax ? parseFloat(filters.valorMax) : null;

    if (min != null && !Number.isNaN(min) && (valor == null || valor < min)) {
      return false;
    }
    if (max != null && !Number.isNaN(max) && (valor == null || valor > max)) {
      return false;
    }

    if (filters.cidade.trim()) {
      const cidade = getLicitacaoCidade(match.licitacao).toLowerCase();
      if (!cidade.includes(filters.cidade.trim().toLowerCase())) return false;
    }

    return true;
  });
}

export function MatchesTable({ matches, filters, onSelect }: MatchesTableProps) {
  const filtered = useMemo(
    () => applyFilters(matches, filters),
    [matches, filters],
  );

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <p className="text-muted-foreground">
          Nenhuma licitação encontrada com os filtros atuais.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Relevância</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((match) => (
            <TableRow
              key={match.id}
              className="cursor-pointer"
              onClick={() => onSelect(match)}
            >
              <TableCell className="max-w-xs font-medium">
                {truncate(match.licitacao.titulo)}
              </TableCell>
              <TableCell>
                {formatCurrency(getLicitacaoValor(match.licitacao))}
              </TableCell>
              <TableCell>{getLicitacaoCidade(match.licitacao)}</TableCell>
              <TableCell>
                {formatDate(getLicitacaoDeadline(match.licitacao))}
              </TableCell>
              <TableCell>
                <span className="font-semibold text-emerald-700">
                  {formatRelevancia(match.relevancia_score)}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(match.status)}>
                  {match.status === "novo"
                    ? "Novo"
                    : match.status === "visto"
                      ? "Visto"
                      : match.status === "inscrito"
                        ? "Inscrito"
                        : match.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
