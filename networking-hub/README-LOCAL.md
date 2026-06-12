# Networking — modo local (sem .env)

Roda **sem Docker**, **sem Redis** e **sem arquivo `.env`**.

## Subir

```bash
cd networking-hub
npm install
npm run dev
```

Em outro terminal:

```bash
cd networking-web
npm run dev
```

- API: http://localhost:3000  
- Site: http://localhost:3002  

## Login demo (criado automaticamente no primeiro start)

- E-mail: `demo@fipecafi.local`  
- Senha: `demo123456`  

## O que o modo local usa

| Recurso | Substituto |
|---------|------------|
| Postgres (Docker) | PGlite em `.data/networking-pglite` |
| Redis + worker | Embeddings processados na hora (inline) |
| Google/OpenAI embeddings | Vetor **mock** (match funciona para demo) |
| Web3 | Desligado |

## Forçar modo local com `.env` parcial

```bash
set NETWORKING_LOCAL=true
npm run dev
```

## Produção / setup completo

Use `networking-hub/.env.example` com Postgres, Redis e `EMBEDDING_PROVIDER=google`.
