# Licitações Advocacia — integração App-Contabilidade

Módulo de licitações jurídicas integrado ao portal **site-de-notas-futurista**, com acesso **restrito ao proprietário** (`cartoonhq@gmail.com` via `hasExtendedScope`).

## Estrutura

```
App-Contabilidade/
├── licitacoes-advocacia/     # Backend, scraper, classificador, migrations Supabase
└── site-de-notas-futurista/
    ├── app/dashboard/licitacoes/   # Dashboard (GitHub Pages)
    ├── components/licitacoes/      # UI do módulo
    ├── lib/licitacoes/             # Client Firebase Callable + types
    └── functions/licitacoes-api.js # Proxy seguro → Supabase
```

## URL de acesso

Após deploy no GitHub Pages:

```
https://<seu-usuario>.github.io/App-Contabilidade/dashboard/licitacoes/
```

Somente usuários logados com e-mail **cartoonhq@gmail.com** conseguem abrir a rota. Outros são redirecionados para `/dashboard/`.

## Configuração Supabase

1. Execute as migrations em `licitacoes-advocacia/database/` (incluindo `004_owner_cartoonhq.sql`)
2. Configure secrets nas **Firebase Functions**:

```bash
firebase functions:config:set \
  licitacoes.supabase_url="https://SEU-PROJETO.supabase.co" \
  licitacoes.service_role_key="SUA_SERVICE_ROLE_KEY"
```

Ou variáveis de ambiente no Firebase Console:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Deploy das functions:

```bash
cd site-de-notas-futurista/functions
npm install
firebase deploy --only functions:licitacoesApi
```

## Backend do pipeline (opcional — Railway)

O job de scraping/classificação roda em `licitacoes-advocacia/backend`:

```bash
cd licitacoes-advocacia/backend
npm install
npm run setup:python
npm run job:collect
```

Deploy separado no Railway (ver `licitacoes-advocacia/railway.toml`).

## Desenvolvimento local

```bash
cd site-de-notas-futurista
npm install
npm run dev
```

Acesse: `http://localhost:3000/dashboard/licitacoes/` (logado como cartoonhq@gmail.com).

Use emulador Firebase Functions para testar a API localmente, ou deploy das functions em staging.

## Segurança

- **Frontend (GitHub Pages):** gate por Firebase Auth + `hasExtendedScope`
- **Dados (Supabase):** acesso apenas via Cloud Function `licitacoesApi`, que valida o token Firebase e o e-mail owner antes de usar a service role key

A service role key **nunca** vai para o frontend.
