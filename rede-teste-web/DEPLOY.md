# Rede Teste — deploy online (1 clique)

Sem GCP, sem secrets no GitHub.

## Deploy automático (Render + Supabase Juridiquês)

1. Clique: **[Deploy to Render](https://render.com/deploy?repo=https://github.com/Linduro/App-Contabilidade)**
2. Conecte GitHub e confirme o blueprint (`render.yaml`)
3. No primeiro deploy, o Render pede as variáveis marcadas como secret (`sync: false`)

### Variáveis secretas (copiar do Juridiquês)

| Variável | Onde pegar |
|----------|------------|
| `DATABASE_URL` | Supabase → **Connection pooler** (porta **6543**, `pgbouncer=true`) — **não** use `db.*.supabase.co` no Render (só IPv6) |
| `DIRECT_DATABASE_URL` | Pooler sessão (porta **5432**) para `prisma db push` no startup |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → `service_role` (JWT) |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys → secret key (`sb_secret_...`) |
| `BETTER_AUTH_SECRET` | Mesmo segredo do AdvForte/Juridiquês |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys → publishable (`sb_publishable_...`) — opcional para uploads server-side |
| `GIPHY_API_KEY` | [developers.giphy.com](https://developers.giphy.com) — busca de GIF no composer |
| `TENOR_API_KEY` | Fallback se não houver GIPHY |
| `CRON_SECRET` | Segredo para `GET /api/cron/publish-scheduled` (posts agendados) |

**Projeto Supabase:** `diuudxdcemegubuajvql`  
**URL:** `https://diuudxdcemegubuajvql.supabase.co`  
**Bucket storage:** `advforte`

### Script automático (se tiver API key do Render)

Arquivo local (não vai pro git): `rede-teste-web/.env.render`

```powershell
cd App-Contabilidade
$env:RENDER_API_KEY = "rnd_sua_chave_aqui"
node scripts/push-rede-teste-render-env.mjs
```

API key: [Render → Account Settings → API Keys](https://dashboard.render.com/u/settings#api-keys)

**Login:** portal GitHub Pages → botão Rede Teste → Firebase (sem cadastro separado).  
Não precisa de `FIREBASE_SERVICE_ACCOUNT` — validação do token usa chaves públicas do Google.

## Portal (GitHub Pages)

Após o Render subir, o portal aponta por padrão para `https://rede-teste.onrender.com`.  
Se a URL for outra, defina a variable `REDE_TESTE_URL` no GitHub e rode o deploy do portal.

## Cloud Run (legado)

Opcional. Requer `FIREBASE_SERVICE_ACCOUNT` do projeto `contabilidade-ebed6` + IAM.  
Prefira Render.

## Local

```bash
cd rede-teste-web
cp .env.example .env
npm install
npm run db:push && npm run db:seed
npm run dev
```

Para Supabase local, use a mesma `DATABASE_URL` do Juridiquês no `.env`.
