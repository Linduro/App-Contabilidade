# AFS Market Intelligence

Motor de inteligência de mercado B2B da **Asset Flow Solutions (AFS)** — extração, enriquecimento, validação e funil comercial para conformidade patrimonial e buscas adaptáveis.

> **Deploy produção:** `ENABLE_GCP_CLOUD_RUN=true` no GitHub → workflow *Deploy AFS Market Intelligence (Cloud Run)*. Setup GCP: `node scripts/setup-gcp-cloudrun.mjs`.

## Propósito

- Minerar dados públicos da Receita Federal (Lucro Real, ~230k ICP)
- Categorizar por cluster (Agro, Indústria, Varejo)
- Enriquecer contatos institucionais via cascata gratuita (RF → APIs → site → MX → OSM)
- Validar e-mails (MX, sem SMTP massivo) com roteamento **Dead Zone**
- Monitorar transição Presumido → Lucro Real
- Export Excel para abordagem manual
- Opt-out LGPD por CNPJ

## Documentação

- [Pipeline de Dados (camadas 1–5)](docs/PIPELINE_DADOS.md)
- [Minha Receita self-hosted (opcional)](docs/MINHA_RECEITA.md)
- [Plano Conceitual Completo](docs/PLANO_CONCEITUAL.md)

## Estrutura

```
afs-market-intelligence/
├── app.py                 # Entrada Flask
├── config/                # ICP, clusters, layout RF
├── data/                  # DuckDB, exports, segmentações
├── db/                    # schema.sql, schema_prospect.sql, schema_enrichment.sql
├── layers/
│   ├── ingestion/         # RF download + carga (Camada 1)
│   ├── categorization/    # ICP, prospectos_rf, busca Leads2b
│   ├── enrichment/        # APIs, contato_cascade, site, geo (Camadas 2–4)
│   ├── validation/        # MX / anti-bounce
│   ├── scraping/          # Fila de enriquecimento
│   └── dead_zone/         # Rotas alternativas
├── orchestrator/          # Pipeline unificado
├── export/                # Excel
├── ui/                    # Rotas API + templates
└── static/                # SPA hash routing
```

## Instalação

```bash
cd afs-market-intelligence
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env
python app.py
```

Servidor: `http://localhost:5001`

## Portal (SPA + Firestore)

Integrado ao portal principal em `/dashboard/afs-market-intelligence/` (mesmo padrão do AFS Valuation).

A interface web usa **Firebase SDK v9 modular** (vanilla JS) com coleções:

- `leads` — empresas ICP (filtradas por `cnpj_basico` / `perfil_icp`, separadas dos leads trabalhistas)
- `historico_contato`, `parceiros`, `configuracoes`

### Configuração Firebase

1. Copie `static/config.json.example` → `site-de-notas-futurista/public/afs-market-intelligence/config.json`
2. Preencha `firebase` com as credenciais do projeto (não commitar secrets reais)
3. Habilite **Email/Senha** no Firebase Authentication
4. Deploy das regras (no portal):

```bash
cd site-de-notas-futurista
npx firebase deploy --only firestore:rules
```

5. Usuários autorizados (mesma senha do login do portal):

- `cartoonhq@gmail.com`
- `gabrieldouran@gmail.com`

A SPA reutiliza a sessão Firebase do portal — não há login separado.
Acesse pelo dashboard ou faça sign-in no portal e será redirecionado automaticamente.

6. Rebuild estático após alterações:

```bash
cd site-de-notas-futurista
node scripts/copy-afs-market-static.mjs
```

## Perfis de uso

| Perfil | Descrição |
|--------|-----------|
| `patrimonial` | ICP AFS padrão (CPC/ABNT) |
| `generico` | Busca livre configurável |
| `transicao_regime` | Monitor de migração tributária |
| `parceiros_auditoria` | Funil B2B2B |

Configure em `config/profiles.yaml`.

## Deploy

- Docker: `docker build -t afs-market-intelligence .`
- Cloud Run: workflow `.github/workflows/deploy-afs-market-cloudrun.yml`
