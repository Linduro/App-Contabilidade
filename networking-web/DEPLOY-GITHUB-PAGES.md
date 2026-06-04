# Networking no GitHub Pages (mesmo domínio)

O frontend é publicado junto com o portal, em uma subpasta **difícil de adivinhar**:

```
https://<seu-usuario>.github.io/App-Contabilidade/_internal/f7c2-network/
```

Com domínio customizado no GitHub Pages, o prefixo `/App-Contabilidade` continua igual ao do portal.

## URLs

| App | Caminho |
|-----|---------|
| Portal de notas | `/App-Contabilidade/` |
| Networking | `/App-Contabilidade/_internal/f7c2-network/` |

Exemplos:

- Login: `.../App-Contabilidade/_internal/f7c2-network/login/`
- Demo: `demo@fipecafi.local` / `demo123456` (só se a API estiver no ar)

## API (obrigatório para o app funcionar)

GitHub Pages serve **só arquivos estáticos**. A API (`networking-hub`) precisa estar em outro host (Railway, Render, VPS).

No repositório GitHub: **Settings → Secrets and variables → Actions → Variables**

| Variável | Exemplo |
|----------|---------|
| `NETWORKING_API_URL` | `https://sua-api.up.railway.app` |

Sem isso, o site abre mas login/rede falham.

## Deploy

Push na branch `main` dispara `.github/workflows/deploy.yml`.

## Local (sem subpasta)

```bash
cd networking-web
npm run dev
```

`http://localhost:3002` — sem `basePath`.

## Alterar a subpasta

Edite em dois lugares:

1. `networking-web/next.config.mjs` — `NETWORKING_PAGES_SEGMENT`
2. `.github/workflows/deploy.yml` — `NETWORKING_PAGES_SEGMENT`
