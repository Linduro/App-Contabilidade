/**
 * Cliente Supabase in-memory para testes de pipeline.
 */
export function createInMemorySupabase(seed = {}) {
  /** @type {Record<string, Array<Record<string, unknown>>>} */
  const tables = {
    advogados: [...(seed.advogados ?? [])],
    especialidades_advogados: [...(seed.especialidades_advogados ?? [])],
    advogados_especialidades: [...(seed.advogados_especialidades ?? [])],
    licitacoes: [...(seed.licitacoes ?? [])],
    matches: [...(seed.matches ?? [])],
  };

  let idCounter = 1;

  function nextId(prefix) {
    return `${prefix}-${idCounter++}`;
  }

  function clone(value) {
    return structuredClone(value);
  }

  /**
   * @param {string} table
   */
  function from(table) {
    /** @type {Array<{ column: string, value: unknown, op?: string }>} */
    const filters = [];
    let selectedColumns = "*";
    let limitCount = null;
    let orderSpec = null;
    let insertPayload = null;
    let updatePayload = null;
    let isSingle = false;
    let headOnly = false;

    const api = {
      select(columns = "*", options = {}) {
        selectedColumns = columns;
        headOnly = options.head === true;
        return api;
      },
      eq(column, value) {
        filters.push({ column, value, op: "eq" });
        return api;
      },
      neq(column, value) {
        filters.push({ column, value, op: "neq" });
        return api;
      },
      gte(column, value) {
        filters.push({ column, value, op: "gte" });
        return api;
      },
      in(column, values) {
        filters.push({ column, value: values, op: "in" });
        return api;
      },
      order(column, { ascending = true } = {}) {
        orderSpec = { column, ascending };
        return api;
      },
      limit(count) {
        limitCount = count;
        return api;
      },
      insert(payload) {
        insertPayload = payload;
        return api;
      },
      update(payload) {
        updatePayload = payload;
        return api;
      },
      maybeSingle() {
        isSingle = true;
        limitCount = 1;
        return execute();
      },
      single() {
        isSingle = true;
        limitCount = 1;
        return execute();
      },
      then(resolve, reject) {
        return execute().then(resolve, reject);
      },
    };

    function applyFilters(rows) {
      return rows.filter((row) =>
        filters.every(({ column, value, op }) => {
          if (op === "eq") return row[column] === value;
          if (op === "neq") return row[column] !== value;
          if (op === "gte") return row[column] >= value;
          if (op === "in") return value.includes(row[column]);
          return true;
        }),
      );
    }

    function expandRow(row, tableName) {
      if (typeof selectedColumns !== "string" || !selectedColumns.includes(":")) {
        return clone(row);
      }

      const expanded = clone(row);

      if (tableName === "matches") {
        if (selectedColumns.includes("advogado:advogados")) {
          expanded.advogado = clone(
            tables.advogados.find((a) => a.id === row.advogado_id) ?? null,
          );
        }
        if (selectedColumns.includes("licitacao:licitacoes")) {
          expanded.licitacao = clone(
            tables.licitacoes.find((l) => l.id === row.licitacao_id) ?? null,
          );
        }
        if (selectedColumns.includes("especialidade:especialidades_advogados")) {
          expanded.especialidade = clone(
            tables.especialidades_advogados.find(
              (e) => e.id === row.especialidade_id,
            ) ?? null,
          );
        }
      }

      if (tableName === "advogados_especialidades") {
        if (selectedColumns.includes("advogado:advogados")) {
          expanded.advogado = clone(
            tables.advogados.find((a) => a.id === row.advogado_id) ?? null,
          );
        }
        if (selectedColumns.includes("especialidade:especialidades_advogados")) {
          expanded.especialidade = clone(
            tables.especialidades_advogados.find(
              (e) => e.id === row.especialidade_id,
            ) ?? null,
          );
        }
      }

      return expanded;
    }

    async function execute() {
      if (insertPayload) {
        const rows = Array.isArray(insertPayload) ? insertPayload : [insertPayload];
        const inserted = [];

        for (const row of rows) {
          const duplicate = tables[table].find((existing) => {
            if (table === "licitacoes") {
              return existing.hash_conteudo === row.hash_conteudo;
            }
            if (table === "matches") {
              return (
                existing.licitacao_id === row.licitacao_id &&
                existing.advogado_id === row.advogado_id
              );
            }
            return false;
          });

          if (duplicate) {
            return {
              data: null,
              error: { code: "23505", message: "duplicate key value" },
            };
          }

          const record = {
            id: row.id ?? nextId(table.slice(0, 4)),
            created_at: new Date().toISOString(),
            ...row,
          };
          tables[table].push(record);
          inserted.push(clone(record));
        }

        return {
          data: isSingle ? inserted[0] : inserted,
          error: null,
        };
      }

      if (updatePayload) {
        const targetIds = filters.find((f) => f.op === "in")?.value ?? null;
        let updated = 0;

        tables[table] = tables[table].map((row) => {
          const matchesFilters = applyFilters([row]).length === 1;
          const matchesIn =
            targetIds && row.id && targetIds.includes(row.id);

          if (matchesFilters || matchesIn) {
            updated += 1;
            return { ...row, ...updatePayload };
          }
          return row;
        });

        if (headOnly) {
          return { data: null, count: updated, error: null };
        }

        return { data: null, error: null };
      }

      let rows = applyFilters([...tables[table]]);

      if (orderSpec) {
        rows.sort((a, b) => {
          const av = a[orderSpec.column];
          const bv = b[orderSpec.column];
          if (av === bv) return 0;
          return orderSpec.ascending ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
        });
      }

      if (limitCount != null) {
        rows = rows.slice(0, limitCount);
      }

      rows = rows.map((row) => expandRow(row, table));

      if (headOnly) {
        return { data: null, count: rows.length, error: null };
      }

      return { data: isSingle ? rows[0] ?? null : rows, error: null };
    }

    return api;
  }

  return {
    from,
    /** expõe estado para asserções */
    _tables: tables,
  };
}
