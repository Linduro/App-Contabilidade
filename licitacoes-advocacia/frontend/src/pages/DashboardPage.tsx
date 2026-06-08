import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MatchFiltersBar } from "@/components/dashboard/MatchFiltersBar";
import { MatchesTable } from "@/components/dashboard/MatchesTable";
import { MatchDetailModal } from "@/components/dashboard/MatchDetailModal";
import type { Match } from "@/types";

export function DashboardPage() {
  const { advogado } = useAuth();
  const {
    matches,
    especialidades,
    stats,
    filters,
    setFilters,
    loading,
    error,
    updateMatchStatus,
  } = useDashboardData(advogado?.id);

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleSelect = async (match: Match) => {
    setSelectedMatch(match);
    setModalOpen(true);

    if (match.status === "novo") {
      try {
        await updateMatchStatus(match.id, "visto");
        setSelectedMatch({ ...match, status: "visto" });
      } catch {
        // mantém modal aberto mesmo se falhar marcar visto
      }
    }
  };

  const handleInscrito = async (matchId: string) => {
    setActionLoading(true);
    try {
      await updateMatchStatus(matchId, "inscrito");
      setSelectedMatch((prev) =>
        prev?.id === matchId ? { ...prev, status: "inscrito" } : prev,
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async (matchId: string) => {
    setActionLoading(true);
    try {
      await updateMatchStatus(matchId, "arquivado");
      setModalOpen(false);
      setSelectedMatch(null);
    } finally {
      setActionLoading(false);
    }
  };

  if (!advogado) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">
          Perfil de advogado não encontrado. Entre em contato com o suporte.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar especialidades={especialidades} stats={stats} />

      <main className="flex-1 overflow-auto">
        <div className="border-b bg-card px-8 py-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Suas licitações
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Matches ordenados por relevância — clique para ver detalhes
          </p>
        </div>

        <div className="space-y-6 p-8">
          <MatchFiltersBar
            filters={filters}
            onChange={setFilters}
            especialidades={especialidades}
          />

          {loading ? (
            <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
              Carregando licitações…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <MatchesTable
              matches={matches}
              filters={filters}
              onSelect={handleSelect}
            />
          )}
        </div>
      </main>

      <MatchDetailModal
        match={selectedMatch}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onMarkInscrito={handleInscrito}
        onArchive={handleArchive}
        loading={actionLoading}
      />
    </div>
  );
}
