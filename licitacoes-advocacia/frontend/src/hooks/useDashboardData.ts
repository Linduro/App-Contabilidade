import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { startOfCurrentMonth } from "@/lib/formatters";
import type {
  AdvogadoEspecialidade,
  DashboardStats,
  Match,
  MatchFilters,
} from "@/types";

const DEFAULT_FILTERS: MatchFilters = {
  especialidadeId: "all",
  valorMin: "",
  valorMax: "",
  cidade: "",
};

export function useDashboardData(advogadoId: string | undefined) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [especialidades, setEspecialidades] = useState<AdvogadoEspecialidade[]>(
    [],
  );
  const [stats, setStats] = useState<DashboardStats>({
    abertasMes: 0,
    inscricoesMes: 0,
  });
  const [filters, setFilters] = useState<MatchFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!advogadoId) return;

    setLoading(true);
    setError(null);

    try {
      const monthStart = startOfCurrentMonth();

      const [matchesRes, espRes, abertasRes, inscricoesRes] = await Promise.all([
        supabase
          .from("matches")
          .select(
            `
            id,
            licitacao_id,
            advogado_id,
            especialidade_id,
            relevancia_score,
            motivo,
            status,
            notificado,
            visto_em,
            inscrito_em,
            arquivado_em,
            created_at,
            licitacao:licitacoes(*),
            especialidade:especialidades_advogados(*)
          `,
          )
          .eq("advogado_id", advogadoId)
          .neq("status", "arquivado")
          .order("relevancia_score", { ascending: false }),

        supabase
          .from("advogados_especialidades")
          .select(
            `
            especialidade_id,
            nivel_experiencia,
            especialidade:especialidades_advogados(*)
          `,
          )
          .eq("advogado_id", advogadoId),

        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("advogado_id", advogadoId)
          .neq("status", "arquivado")
          .gte("created_at", monthStart),

        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("advogado_id", advogadoId)
          .eq("status", "inscrito")
          .gte("inscrito_em", monthStart),
      ]);

      if (matchesRes.error) throw matchesRes.error;
      if (espRes.error) throw espRes.error;
      if (abertasRes.error) throw abertasRes.error;
      if (inscricoesRes.error) throw inscricoesRes.error;

      setMatches((matchesRes.data as unknown as Match[]) ?? []);
      setEspecialidades(
        (espRes.data as unknown as AdvogadoEspecialidade[]) ?? [],
      );
      setStats({
        abertasMes: abertasRes.count ?? 0,
        inscricoesMes: inscricoesRes.count ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }, [advogadoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateMatchStatus = async (
    matchId: string,
    status: Match["status"],
  ) => {
    const payload: Record<string, unknown> = { status };
    const now = new Date().toISOString();

    if (status === "visto") payload.visto_em = now;
    if (status === "inscrito") payload.inscrito_em = now;
    if (status === "arquivado") payload.arquivado_em = now;

    const { error: updateError } = await supabase
      .from("matches")
      .update(payload)
      .eq("id", matchId);

    if (updateError) throw updateError;

    if (status === "arquivado") {
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } else {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? {
                ...m,
                status,
                visto_em: status === "visto" ? now : m.visto_em,
                inscrito_em: status === "inscrito" ? now : m.inscrito_em,
              }
            : m,
        ),
      );

      if (status === "inscrito") {
        setStats((prev) => ({
          ...prev,
          inscricoesMes: prev.inscricoesMes + 1,
        }));
      }
    }
  };

  return {
    matches,
    especialidades,
    stats,
    filters,
    setFilters,
    loading,
    error,
    reload: loadData,
    updateMatchStatus,
  };
}
