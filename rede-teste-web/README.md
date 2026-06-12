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

## Deploy online (Cloud Run + GitHub Pages)

1. GitHub → **Settings → Secrets**:
   - `REDE_TESTE_DATABASE_URL` (Neon)
   - `REDE_TESTE_AUTH_SECRET`
   - `FIREBASE_SERVICE_ACCOUNT` (JSON — mesmo do projeto GCP)
2. GitHub → **Settings → Variables**:
   - `ENABLE_REDE_TESTE_CLOUD_RUN` = `true`
3. Push em `main` → workflow `Deploy Rede Teste (Cloud Run)`.
4. Copie a URL do Cloud Run para a variable **`REDE_TESTE_URL`**.
5. Novo deploy do portal (GitHub Pages) para embutir a URL no botão Rede Teste.

## Portal

O portal acadêmico (`site-de-notas-futurista`) integra a home no estilo perfil e link em `/dashboard/rede-teste/`.

<!-- deploy-trigger: 2026-06-03-iam -->
