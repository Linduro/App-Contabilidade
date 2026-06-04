# FIPECAFI Network — Frontend

Next.js 14 (App Router) + Tailwind + shadcn-style UI + D3 + Zustand + TanStack Query.

## Pré-requisitos

API `networking-hub` rodando em `http://localhost:3000` (Postgres + Redis via Docker).

## Configuração

```bash
cd networking-web
npm install
cp .env.local.example .env.local   # se ainda não existir
npm run dev   # http://localhost:3002
```

## Rotas

| Rota | Descrição |
|------|-----------|
| `/login` | Login JWT |
| `/register` | Cadastro |
| `/dashboard` | Perfil + top 3 matches |
| `/profile/setup` | Onboarding em 3 etapas |
| `/network` | Matches + teia D3 |
| `/profile/:id` | Perfil público |

## Stack

- TypeScript estrito, schemas Zod em `src/types/schemas.ts`
- Estado auth: Zustand (`networking-auth` no localStorage)
- API: `src/lib/api.ts` com `Authorization: Bearer`
