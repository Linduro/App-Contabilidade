# Networking Hub API

Backend do hub de networking inteligente FIPECAFI — perfis profissionais, embeddings semânticos (OpenAI) e teia de expertises.

## Stack

- **Hono** + Node 20 + TypeScript estrito
- **Drizzle ORM** + PostgreSQL 16 + **pgvector**
- **Better Auth** (`better-auth/crypto` para hash de senha + sessões bearer)
- **BullMQ** + Redis (embeddings em background)
- **OpenAI** `text-embedding-3-small` (1536 dims)
- **Zod** + **Vitest**

## Setup local

### 1. Dependências

```bash
cd networking-hub
npm install
cp .env.example .env
```

### 2. PostgreSQL + Redis

```bash
docker run -d --name pg-hub -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=networking_hub -p 5432:5432 pgvector/pgvector:pg16
docker run -d --name redis-hub -p 6379:6379 redis:7
```

### 3. Extensões e schema

```bash
psql $DATABASE_URL -f src/db/migrations/0000_extensions.sql
npm run db:push
```

Índice HNSW (após tabelas criadas):

```sql
CREATE INDEX IF NOT EXISTS profiles_embedding_hnsw_idx
  ON profiles USING hnsw (embedding vector_cosine_ops);
```

### 4. Rodar API + worker

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:worker
```

## Endpoints

| Módulo | Método | Rota |
|--------|--------|------|
| Auth | POST | `/auth/register` |
| Auth | POST | `/auth/login` |
| Auth | POST | `/auth/logout` (Bearer) |
| Auth | GET | `/auth/me` (Bearer) |
| Profile | GET/PUT | `/profiles/me` (Bearer) |
| Profile | GET | `/profiles`, `/profiles/:id` |
| Matching | GET | `/matching/suggestions` (Bearer) |
| Matching | POST | `/matching/recalculate` (Bearer) |
| Graph | GET | `/graph/expertise-web` |
| Graph | GET | `/graph/profile/:id/network` |

### Autenticação

```http
Authorization: Bearer <token>
```

## Deploy Railway

1. Crie projeto com **PostgreSQL** (habilite pgvector na imagem ou extensão) e **Redis**.
2. Serviço **API**: build `npm run build`, start `npm start`, variáveis do `.env.example`.
3. Serviço **Worker**: mesmo repo, start `npm run start:worker`.
4. Rode migrations + SQL de extensões no Postgres do Railway.

## Testes

```bash
npm test
```

## Estrutura

Ver `src/` conforme especificação: `db/`, `modules/{auth,profile,matching,graph}/`, `lib/`, `middleware/`.
