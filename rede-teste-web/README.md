# Rede Teste

Cópia sanitizada do módulo de rede social **Juridiquês** (AdvForte), importada **somente leitura** de `Downloads/adv-forte-sistema-juridico`.

- Nome exibido: **Rede Teste**
- Rotas: `/rede-teste/*`
- **Sem** dados de escritório, Maria Lima ou AdvForte
- **Não altera** o projeto AdvForte na origem

## Reimportar (se o Juridiquês mudar na origem)

```bash
cd App-Contabilidade
node scripts/import-rede-teste-from-juridiques.mjs
```

## Rodar localmente

```bash
cd rede-teste-web
cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

- App: http://localhost:3003/rede-teste/
- Seed: usuários `aluno.demo@rede-teste.local` e `prof.demo@rede-teste.local` (sem senha no seed — cadastre via sign-up)

## Login (sem criar conta na Rede Teste)

1. Usuário entra no **Portal** (Firebase Auth).
2. Clica em **Rede Teste** no dashboard → `/dashboard/rede-teste/`.
3. O portal envia o token Firebase para `/auth/portal` e cria o perfil automaticamente no Neon.

## Deploy online

**Recomendado:** [Deploy to Render](https://render.com/deploy?repo=https://github.com/Linduro/App-Contabilidade) (1 clique — Postgres + app inclusos). Ver `DEPLOY.md`.

Cloud Run (legado): secrets `REDE_TESTE_*` + `FIREBASE_SERVICE_ACCOUNT` + IAM GCP.

## Portal

O portal acadêmico (`site-de-notas-futurista`) integra a home no estilo perfil e link em `/dashboard/rede-teste/`.

<!-- deploy-trigger: 2026-06-03-iam -->
