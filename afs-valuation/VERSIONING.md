# Versionamento — Asset Solutions Valuation

## Linhas de versão

| Versão | Pasta fonte | URL pública (GitHub Pages) | Uso |
|--------|-------------|----------------------------|-----|
| **V1.0** | `afs-valuation-v1.0/` | `/afs-valuation/` | Estável, congelada. Retrocesso seguro. |
| **V1.1** | `afs-valuation-v1.1/` | `/afs-valuation-v1.1/` | Desenvolvimento — alterações futuras aqui. |

A pasta `afs-valuation/` original permanece como legado local; o deploy usa apenas as pastas versionadas.

## Botões no header

- **V1.0** → abre a build estável em `/afs-valuation/`
- **V1.1** → abre a cópia de desenvolvimento em `/afs-valuation-v1.1/`

## Deploy

O script `site-de-notas-futurista/scripts/copy-afs-static.mjs` copia ambas as versões para `public/` antes do build do portal.

```bash
cd site-de-notas-futurista
node scripts/copy-afs-static.mjs
```

## Retroceder

Para voltar ao V1.0: use o botão **V1.0** no app ou acesse diretamente `/afs-valuation/index.html`.

O código V1.0 em `afs-valuation-v1.0/` não deve receber alterações de features — apenas correções críticas de segurança, se necessário.

## Desenvolver V1.1

1. Editar arquivos em `afs-valuation-v1.1/` (templates, `static/js`, CSS).
2. Rodar `copy-afs-static.mjs` e testar em `/afs-valuation-v1.1/`.
3. Commit e push — CI publica ambas as versões.
