# Pipeline de Dados — AFS Market Intelligence (100% gratuito)

## Visão geral

Plataforma de prospecção B2B estilo Leads2b usando **somente fontes abertas/gratuitas**.

| Camada | Fonte | Módulo |
|--------|-------|--------|
| **1 — Cadastro RF** | dadosabertos.rfb.gov.br | `layers/ingestion/rf_*`, `ProspectBuilder` |
| **2 — APIs CNPJ** | BrasilAPI, ReceitaWS, CNPJ.ws (+ Minha Receita opcional) | `layers/enrichment/cnpj_api_client.py` |
| **3 — Contatos** | Cascata A→E (RF → APIs → site → MX → OSM) | `layers/enrichment/contato_cascade.py` |
| **4 — Geo** | IBGE (centroide municipal) | `layers/enrichment/geo_ibge.py` |
| **5 — API/UI** | Flask REST + SPA | `ui/layout.py`, `static/js/` |

## Camada 1 — Ingestão Receita Federal

```bash
# Download + carga + materialização prospectos_rf (~230k LR)
curl -X POST http://localhost:5001/api/rf/ingest \
  -H "Content-Type: application/json" \
  -d '{"skip_download": false, "modo": "completo"}'
```

Fluxo interno:
1. `RFDownloader` — detecta snapshot mensal, baixa ZIPs (Empresas, Estabelecimentos, Sócios, Simples…)
2. `RFLoader` — carga bulk DuckDB (`rf_empresas`, `rf_estabelecimentos`, …)
3. `ProspectBuilder` — JOIN materializado → `prospectos_rf`, `estabelecimentos_rf`, `socios_rf`
4. Heurística Lucro Real: não-optante Simples + porte/capital (view `vw_lucro_real_enriched`)

**Contatos RF (Fonte A):** telefone/e-mail existem nos ZIPs de Estabelecimentos (`ddd1+telefone1`, `correio_eletronico`), embora não apareçam na consulta pública online da RF.

## Camada 2 — Enriquecimento unitário

```bash
curl -X POST http://localhost:5001/api/enriquecer/00000001000100
```

Provedores (cache DuckDB `cnpj_api_cache`, backoff exponencial):
- BrasilAPI — `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`
- ReceitaWS — fallback
- CNPJ.ws — fallback
- **Minha Receita** (opcional, self-hosted) — ver `docs/MINHA_RECEITA.md`

## Camada 3 — Cascata de contatos

Função central: `enriquecer_contato(cnpj)` em `contato_cascade.py`

| Fonte | Descrição | Campo `fonte` |
|-------|-----------|---------------|
| **A** | Estabelecimentos RF (local) | `RF` |
| **B** | APIs com consenso multi-fonte | `API:brasilapi`, etc. |
| **C** | Site institucional (robots.txt + rate limit) | `site_institucional` |
| **D** | Validação MX (dnspython) — **sem SMTP probe** | metadado `entregavel` |
| **E** | OpenStreetMap Nominatim | `OSM:Nominatim` |

Governança LGPD:
- Tabela `contatos` (tipo, valor, fonte, confianca, origem_url)
- Opt-out: `POST /api/opt-out/{cnpj_basico}`
- Apenas contatos **institucionais** públicos

## Camada 4 — Geolocalização

Coordenadas municipais via API IBGE → `geo_municipios` + colunas `lat`/`lng` em `prospectos_rf`.

## Endpoints REST

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/rf/ingest` | Ingestão RF completa |
| POST | `/api/prospeccao/search` | Busca paginada (Leads2b-style) |
| POST | `/api/prospeccao/count` | Contagens por aba |
| POST | `/api/prospeccao/enriquecer` | Enfileira CNPJs (`processar: true` roda lote) |
| POST | `/api/enriquecer/{cnpj}` | Cascata imediata |
| GET | `/api/contatos/{cnpj_basico}` | Contatos coletados |
| POST | `/api/opt-out/{cnpj_basico}` | Supressão LGPD |
| POST | `/api/scraping/run` | Processa fila pendente |
| GET | `/api/scraping/queue` | Status da fila |

## Operação

```bash
cd afs-market-intelligence
pip install -r requirements.txt
python app.py   # http://localhost:5001
```

Deploy: GitHub Actions `deploy-afs-market-cloudrun.yml` (requer `ENABLE_GCP_CLOUD_RUN=true`).

## O que NÃO usamos

- **LinkedIn / Instagram scraping** — viola ToS das plataformas e não é defensável sob LGPD para prospecção automatizada. O tutorial Grok AI **não foi implementado** de propósito.
- Bases de contatos compradas
- SMTP probing em massa (queima reputação de IP)

Alternativa legítima para decisores: enriquecer contatos institucionais (Camada 3) + importação manual assistida no CRM.
