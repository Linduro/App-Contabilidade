# Plano de Infraestrutura Online — APIs e Raspagem de Dados

> AFS Market Intelligence · Fase 2 · Extração real da base RF → ~230k Lucro Real

---

## 1. Visão Geral

A aplicação evolui de **protótipo com dados demo** para **motor de dados online** com três subsistemas:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SUBSISTEMA A — Ingestão RF (Receita Federal)                           │
│  Download paralelo → DuckDB em disco → View ICP Lucro Real (~230k)      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  SUBSISTEMA B — APIs REST + Jobs Assíncronos (Cloud Run)                │
│  POST /api/rf/ingest · GET /api/jobs/{id} · SSE progresso               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  SUBSISTEMA C — Raspagem Comercial (Fila rate-limited)                   │
│  Google · LinkedIn · Sites corporativos · CVM                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Subsistema A — Base CNPJ Receita Federal

### 2.1 Fonte oficial

| Recurso | URL |
|---------|-----|
| Portal principal | https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj/ |
| URL alternativa | https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/ |
| Layout colunas | [PDF Layout RF](https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/consultas/arquivos/NOVOLAYOUTDOSDADOSABERTOSDOCNPJ.pdf) |
| Atualização | Mensal (~6 GB compactado, ~20 GB extraído) |

### 2.2 Arquivos necessários

| Arquivo | Partes | Uso |
|---------|--------|-----|
| `Empresas` | 0–9 | Razão social, capital social, porte, natureza jurídica |
| `Estabelecimentos` | 0–9 | CNAE, UF, filiais, telefone, e-mail cadastral, situação |
| `Simples` | único | **Chave para Lucro Real** — exclusão do Simples Nacional |
| `Cnaes` | único | Descrição de atividades |
| `Socios` | 0–9 | Quadro societário (enriquecimento futuro) |
| Auxiliares | Municipios, Naturezas, etc. | Lookup tables |

### 2.3 Por que DuckDB em disco (não RAM)

- Dataset completo: **~50M empresas**, **~60M estabelecimentos**
- DuckDB lê CSV direto do ZIP via `read_csv` / `COPY` sem materializar tudo na RAM
- Cloud Run com **2 GiB RAM + volume persistente** ou disco efêmero com Parquet intermediário
- Queries analíticas (GROUP BY, JOIN, HAVING) executam em streaming

### 2.4 Identificação de Lucro Real (~230k empresas)

O regime tributário **não está explícito** na base RF. Usamos proxy composto validado pelo mercado:

```sql
-- Empresa candidata a Lucro Real quando:
-- 1. NÃO está no Simples Nacional ativo
-- 2. Capital social >= R$ 2.000.000
-- 3. Situação cadastral ATIVA (02)
-- 4. Natureza jurídica empresarial (Ltda, S/A)
-- 5. Mais de 3 estabelecimentos ativos
-- 6. CNAE em cluster AFS (Agro / Indústria / Varejo)
```

**Regra Simples Nacional:**

| Condição | Interpretação |
|----------|---------------|
| `simples.cnpj_basico IS NULL` | Nunca optou — candidato LR |
| `opcao_pelo_simples = 'N'` | Não optou — candidato LR |
| `data_exclusao_simples IS NOT NULL` | Saiu do Simples — **lead quente transição** |
| `opcao_pelo_simples = 'S'` AND exclusão vazia | Simples ativo — **excluir** |

Estimativa: ~230k empresas após todos os filtros (universo endereçável AFS).

### 2.5 Pipeline de ingestão (etapas)

```
Etapa 1  listar_versoes()        → descobre YYYY-MM mais recente
Etapa 2  download_paralelo()     → 4 threads, retoma downloads parciais
Etapa 3  validar_zip()           → integridade antes de processar
Etapa 4  carregar_duckdb()       → staging → tabelas tipadas com layout RF
Etapa 5  criar_views()            → vw_estabelecimentos_ativos, vw_lucro_real_icp
Etapa 6  aplicar_icp()           → INSERT leads_icp (~230k)
Etapa 7  registrar_snapshot()    → versionamento mensal para monitor regime
```

**Tempo estimado (Cloud Run 2 vCPU):** 45–90 min primeira carga; incrementais ~20 min.

---

## 3. Subsistema B — APIs Online

### 3.1 Endpoints de ingestão RF

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/rf/versoes` | Lista versões YYYY-MM disponíveis na RF |
| `GET` | `/api/rf/status` | Snapshot atual, contagem empresas/leads |
| `POST` | `/api/rf/ingest` | Inicia job assíncrono de ingestão completa |
| `POST` | `/api/rf/icp` | Reprocessa só filtro ICP (após carga) |

### 3.2 Endpoints de jobs

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/jobs` | Lista jobs recentes |
| `GET` | `/api/jobs/{id}` | Status, progresso %, logs |
| `GET` | `/api/jobs/{id}/stream` | SSE — progresso em tempo real |

**Estados do job:** `queued` → `downloading` → `loading` → `filtering` → `done` | `error`

### 3.3 Endpoints de raspagem

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/scraping/enqueue` | Enfileira lote de CNPJs para enriquecimento |
| `GET` | `/api/scraping/queue` | Fila pendente / em processamento |
| `POST` | `/api/scraping/run` | Processa N itens da fila (worker tick) |

### 3.4 Deploy

| Ambiente | Serviço | Config |
|----------|---------|--------|
| Produção | Cloud Run `afs-market-intelligence` | 2 GiB RAM, 2 vCPU, timeout 3600s |
| Dados | Volume `/app/data` ou GCS bucket | DuckDB + ZIPs RF |
| Agendamento | GitHub Actions cron mensal | `0 6 5 * *` — dia 5 de cada mês |
| Pages | Frontend estático | Chama API Cloud Run via `config.json` |

---

## 4. Subsistema C — Raspagem Comercial Online

### 4.1 Fila de raspagem

Cada lead ICP entra na fila `scraping_queue`:

```json
{
  "cnpj_basico": "12345678",
  "razao_social": "Empresa X",
  "prioridade": 8.5,
  "tarefas": ["google_decisores", "linkedin_confirmar", "site_corporativo", "email_rf"]
}
```

### 4.2 Workers e rate limits

| Fonte | Delay | Limite/hora | Modo |
|-------|-------|-------------|------|
| Google Search | 3–8 s | 200 queries | HTML scrape / SerpAPI opcional |
| LinkedIn | 5–12 s | 100 perfis | Confirmar/preencher — **sem automação de mensagens** |
| Site corporativo | 2–5 s | 500 páginas | BeautifulSoup + regex e-mail |
| E-mail RF | instantâneo | — | Dado cadastral do estabelecimento matriz |
| CVM/RI | 3–6 s | 150 | Empresas abertas |

### 4.3 Ordem de execução por lead

```
1. E-mail cadastral RF (matriz)          → gratuito, imediato
2. Google: "{razao}" CFO controller      → nomes + e-mails
3. Site: /sobre /governanca /contato     → confirma decisores
4. LinkedIn: confirmar OU preencher      → eleva score confiança
5. Validação MX + SMTP ping              → anti-bounce
6. Dead Zone se falhar                   → rota alternativa
```

### 4.4 Processamento em lote

- **Fase 1 (semana 1):** Top 1.000 leads por score — validação manual do pipeline
- **Fase 2 (semana 2–4):** 10.000 leads/mês
- **Fase 3 (contínuo):** universo completo ~230k em ~24 meses com priorização por score

---

## 5. Cronograma de Implementação

| Fase | Entrega | Prazo sugerido |
|------|---------|----------------|
| **Fase 1** | Download RF paralelo + DuckDB + filtro Lucro Real | Semana 1–2 |
| **Fase 2** | APIs jobs assíncronos + SSE progresso | Semana 2–3 |
| **Fase 3** | Fila raspagem + worker Google/LinkedIn | Semana 3–5 |
| **Fase 4** | GitHub Actions cron mensal RF | Semana 5 |
| **Fase 5** | GCS persistente + reprocessamento incremental | Semana 6–8 |

---

## 6. Infraestrutura Cloud (GCP)

```
GitHub Actions (cron mensal)
        │
        ▼
Cloud Run Job: afs-rf-ingest
        │  download RF → DuckDB → ICP filter
        ▼
Cloud Storage: gs://afs-market-data/
        ├── rf/raw/YYYY-MM/*.zip
        ├── db/afs_market.duckdb
        └── exports/*.xlsx
        │
        ▼
Cloud Run Service: afs-market-intelligence (API + scraping workers)
        │
        ▼
GitHub Pages (frontend) ← config.json → API URL
```

---

## 7. Métricas de sucesso

| Métrica | Meta |
|---------|------|
| Empresas carregadas RF | ~50M |
| Leads ICP Lucro Real | ~230.000 |
| Leads com decisor identificado | >40% |
| E-mails validados | >15% do universo |
| Tempo ingestão mensal | < 90 min |
| Uptime API | > 99% |

---

## 8. Governança e limites

- **RF:** uso conforme licença aberta; sem redistribuição comercial dos brutos
- **Scraping:** respeitar robots.txt; User-Agent identificável; rate limits conservadores
- **LinkedIn:** apenas coleta de perfis públicos; zero automação de mensagens
- **LGPD:** base legítima B2B; direito de oposição documentado
- **Custos GCP:** estimativa ~USD 30–80/mês (Cloud Run + Storage)

---

*Plano v1.0 · AFS Market Intelligence · Asset Flow Solutions*
