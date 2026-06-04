# Deploy no Railway — FIPECAFI Network

Este guia cobre o deploy do **networking-hub** (API + worker), **PostgreSQL**, **Redis** e **networking-web** (frontend Next.js).

## Visão geral dos serviços

| Serviço | Repositório / pasta | Função |
|---------|---------------------|--------|
| PostgreSQL | Plugin Railway | Banco + pgvector |
| Redis | Plugin Railway | Fila BullMQ (embeddings) |
| API | `networking-hub/` | Hono, auth, perfis, matches, conexões |
| Worker | `networking-hub/` (mesmo repo, outro serviço) | Processa jobs de embedding |
| Frontend | `networking-web/` | Next.js 14 |

## Ordem recomendada de deploy

1. **PostgreSQL** — criar plugin e copiar `DATABASE_URL`
2. **Redis** — criar plugin e copiar `REDIS_URL`
3. **API** — deploy `networking-hub` (roda migrations no start)
4. **Worker** — segundo serviço apontando para `networking-hub`, comando `npm run start:worker`
5. **Frontend** — deploy `networking-web` com `NEXT_PUBLIC_API_URL` apontando para a URL pública da API

Opcional após o banco subir: rodar seed localmente ou via one-off no Railway:

```bash
cd networking-hub
npm run seed
```

---

## 1. Criar projeto no Railway

1. Acesse [railway.app](https://railway.app) e crie um **novo projeto**.
2. Conecte o repositório GitHub `App-Contabilidade` (ou faça deploy por pasta).

---

## 2. PostgreSQL

1. No projeto: **+ New** → **Database** → **PostgreSQL**.
2. Abra o serviço → **Variables** → copie `DATABASE_URL` (ou `POSTGRES_URL`).
3. No Postgres, habilite a extensão **vector** (pgvector). No Railway, use imagem compatível ou execute após o primeiro deploy da API:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Os SQL em `networking-hub/src/db/migrations/` também criam extensões e índice HNSW quando `npm run db:migrate` roda no start da API.

---

## 3. Redis

1. **+ New** → **Database** → **Redis**.
2. Copie `REDIS_URL` para os serviços API e Worker.

---

## 4. API (`networking-hub`)

### Configuração do serviço

- **Root Directory:** `networking-hub`
- O arquivo `networking-hub/railway.toml` já define:
  - `startCommand`: `npm run db:migrate && npm start`
  - `healthcheckPath`: `/health`

### Variáveis de ambiente (API)

| Variável | Exemplo / notas |
|----------|-----------------|
| `DATABASE_URL` | Referência ao plugin Postgres `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | Referência ao plugin Redis `${{Redis.REDIS_URL}}` |
| `EMBEDDING_PROVIDER` | `google` ou `openai` |
| `GOOGLE_GENAI_API_KEY` | Obrigatório se `EMBEDDING_PROVIDER=google` |
| `OPENAI_API_KEY` | Obrigatório se `EMBEDDING_PROVIDER=openai` |
| `BETTER_AUTH_SECRET` | String aleatória com **mín. 32 caracteres** |
| `BETTER_AUTH_URL` | URL pública da API, ex. `https://sua-api.up.railway.app` |
| `PORT` | Railway injeta automaticamente |
| `NODE_ENV` | `production` |

### Build

Railway (Nixpacks) executa em geral:

```bash
npm install
npm run build
```

Scripts relevantes no `package.json`:

- `build` → `tsc`
- `start` → `node dist/index.js`
- `db:migrate` → `drizzle-kit migrate`

### Health check

`GET /health` retorna:

```json
{ "status": "ok", "timestamp": "2026-06-04T12:00:00.000Z" }
```

---

## 5. Worker (`networking-hub`)

Crie um **segundo serviço** no mesmo projeto:

- **Root Directory:** `networking-hub`
- **Start Command:** `npm run build && npm run start:worker`
- **Mesmas variáveis** da API (`DATABASE_URL`, `REDIS_URL`, chaves de embedding, etc.)
- **Não** precisa de `BETTER_AUTH_URL` para o worker, mas pode reutilizar o mesmo `.env` por simplicidade.

O worker consome a fila `generate-embedding` no Redis.

---

## 6. Frontend (`networking-web`)

### Configuração do serviço

- **Root Directory:** `networking-web`
- `networking-web/railway.toml`:
  - `startCommand`: `npm run build && npm start`

### Variáveis de ambiente (Frontend)

| Variável | Exemplo |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://sua-api.up.railway.app` (sem barra no final) |
| `PORT` | Injetado pelo Railway |

O script `start` usa `next start -H 0.0.0.0 -p ${PORT:-3000}`.

### CORS

A API já permite `origin: "*"`. Em produção, restrinja ao domínio do frontend se desejar.

---

## 7. Checklist pós-deploy

- [ ] `GET https://sua-api/health` → `status: ok`
- [ ] Registrar usuário no frontend
- [ ] Completar onboarding → worker gera embedding
- [ ] `/network` mostra matches e teia
- [ ] `POST /connections` e página `/connections` funcionam
- [ ] (Opcional) `npm run seed` para dados de demonstração

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| API não sobe | Confira `DATABASE_URL`, `REDIS_URL` e chave do provider de embedding |
| Migrations falham | Rode `npm run db:push` localmente contra o Postgres do Railway ou gere migrations com `npm run db:generate` |
| Matches vazios | Worker rodando? `GOOGLE_GENAI_API_KEY` válida? Perfil com campos preenchidos? |
| Frontend não chama API | `NEXT_PUBLIC_API_URL` deve ser definida **no build** do Next (redeploy após alterar) |

---

## Arquivos de configuração Railway

- `networking-hub/railway.toml` — API
- `networking-web/railway.toml` — Frontend

Consulte também `networking-hub/README.md` e `networking-web/README.md` para desenvolvimento local.
