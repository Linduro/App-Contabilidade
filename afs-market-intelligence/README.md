# AFS Market Intelligence

Motor de inteligência de mercado B2B da **Asset Flow Solutions (AFS)** — extração, enriquecimento, validação e funil comercial para conformidade patrimonial e buscas adaptáveis.

## Propósito

- Minerar dados públicos da Receita Federal (Lucro Real, ~230k ICP)
- Categorizar por cluster (Agro, Indústria, Varejo)
- Enriquecer decisores (CFO, Controller, Gerente Contábil) via scraping + LinkedIn
- Validar e-mails (MX + SMTP ping) com roteamento **Dead Zone**
- Monitorar transição Presumido → Lucro Real
- Canal B2B2B com bancas de auditoria média
- Feedback loop comercial para recalibração de scoring
- Export Excel para abordagem 100% manual

## Documentação

- [Plano Conceitual Completo](docs/PLANO_CONCEITUAL.md)

## Estrutura

```
afs-market-intelligence/
├── app.py                 # Entrada Flask
├── config/                # ICP, clusters, perfis adaptáveis
├── data/                  # Bancas de auditoria, dados locais
├── db/                    # DuckDB/SQLite schema
├── layers/                # Camadas lógicas do pipeline
│   ├── ingestion/         # RF download + carga
│   ├── categorization/    # ICP + clusters
│   ├── enrichment/        # Scraping + LinkedIn
│   ├── validation/        # Anti-bounce
│   ├── dead_zone/         # Rotas alternativas
│   ├── feedback/          # Recalibração
│   ├── regime_monitor/    # Transição de regime
│   └── partnerships/      # B2B2B auditoria
├── orchestrator/          # Pipeline unificado
├── export/                # Excel consolidado
├── ui/                    # Rotas API + templates
└── static/                # Dashboard web
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

5. Seed de demonstração (requer credencial de service account):

```bash
cd afs-market-intelligence
GOOGLE_APPLICATION_CREDENTIALS=../path/sa.json node scripts/seed-firestore.mjs
```

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
