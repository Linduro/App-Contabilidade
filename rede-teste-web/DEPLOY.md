# Rede Teste — deploy online (1 clique)

Sem GCP, sem secrets no GitHub, sem Neon manual.

## Deploy automático (Render)

1. Clique: **[Deploy to Render](https://render.com/deploy?repo=https://github.com/Linduro/App-Contabilidade)**
2. Conecte sua conta GitHub e confirme o blueprint (`render.yaml`)
3. Aguarde ~10–15 min (build Docker + Postgres gratuito)

O Render cria sozinho:

- Postgres `rede-teste-db`
- Web `https://rede-teste.onrender.com`
- `DATABASE_URL`, `BETTER_AUTH_SECRET` (gerados)

**Login:** portal GitHub Pages → botão Rede Teste → Firebase (sem cadastro separado).  
Não precisa de `FIREBASE_SERVICE_ACCOUNT` — validação do token usa chaves públicas do Google.

## Portal (GitHub Pages)

Após o Render subir, o portal já aponta por padrão para `https://rede-teste.onrender.com`.  
Se a URL for outra, defina a variable `REDE_TESTE_URL` no GitHub e rode o deploy do portal.

## Cloud Run (legado)

Opcional. Requer `FIREBASE_SERVICE_ACCOUNT` do projeto `contabilidade-ebed6` + IAM.  
Prefira Render.

## Supabase (opcional — mídia)

Para uploads como no Juridiquês, adicione no Render → Environment:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=rede-teste
```

Ou use o Postgres do Supabase trocando `DATABASE_URL` (Prisma já suporta).

## Local

```bash
cd rede-teste-web
cp .env.example .env
npm install
npm run db:push && npm run db:seed
npm run dev
```
