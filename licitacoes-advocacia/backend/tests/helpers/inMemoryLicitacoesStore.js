/**
 * Store in-memory espelhando licitacoesStore.js para testes.
 */
export function createInMemoryLicitacoesStore(seed = {}) {
  const especialidades = new Map(
    (seed.especialidades ?? []).map((row) => [row.slug ?? row.id, { ...row }]),
  );
  const owner = seed.owner ?? null;
  const licitacoes = [...(seed.licitacoes ?? [])];
  const matches = [...(seed.matches ?? [])];

  let licCounter = 1;
  let matchCounter = 1;

  return {
    _state: { especialidades, owner, licitacoes, matches },

    isLicitacoesStoreConfigured: () => true,

    async hashExists(hash) {
      return licitacoes.some((row) => row.hash_conteudo === hash);
    },

    async loadEspecialidadesBySlug() {
      const map = new Map();
      for (const [slug, row] of especialidades) {
        if (row.ativo === false) continue;
        map.set(slug, row.id ?? slug);
      }
      return map;
    },

    async getAdvogadosByEspecialidade(especialidadeId) {
      if (!owner?.ativo) return [];
      const has = (owner.especialidades ?? []).some(
        (item) => item.slug === especialidadeId,
      );
      if (!has) return [];
      return [
        {
          id: owner.id ?? "owner",
          nome: owner.nome,
          email: owner.email,
          ativo: true,
        },
      ];
    },

    async insertLicitacao(licitacao) {
      const row = {
        id: licitacao.id ?? `lic-${licCounter++}`,
        ...licitacao,
        created_at: new Date().toISOString(),
      };
      licitacoes.push(row);
      return row;
    },

    async createMatch({
      licitacaoId,
      advogadoId,
      especialidadeId,
      relevanciaScore,
      motivo,
    }) {
      const dup = matches.find(
        (m) => m.licitacao_id === licitacaoId && m.advogado_id === advogadoId,
      );
      if (dup) return false;

      const licitacao = licitacoes.find((l) => l.id === licitacaoId);
      const espRow = especialidades.get(especialidadeId);
      if (!licitacao || !espRow) return false;

      matches.push({
        id: `match-${matchCounter++}`,
        licitacao_id: licitacaoId,
        advogado_id: advogadoId,
        especialidade_id: especialidadeId,
        relevancia_score: relevanciaScore,
        motivo,
        status: "novo",
        notificado: false,
        licitacao,
        especialidade: {
          id: espRow.id ?? especialidadeId,
          nome: espRow.nome,
          slug: espRow.slug ?? especialidadeId,
        },
      });

      return true;
    },

    async getUnnotifiedMatches() {
      const advogado = owner
        ? {
            id: owner.id ?? "owner",
            nome: owner.nome,
            email: owner.email,
            ativo: true,
          }
        : null;

      return matches
        .filter((m) => !m.notificado)
        .map((m) => ({
          ...m,
          advogado:
            advogado && m.advogado_id === advogado.id ? advogado : m.advogado,
        }));
    },

    async markMatchesNotified(matchIds) {
      const now = new Date().toISOString();
      for (const match of matches) {
        if (matchIds.includes(match.id)) {
          match.notificado = true;
          match.notificado_em = now;
        }
      }
    },
  };
}
