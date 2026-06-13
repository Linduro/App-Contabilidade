# Minha Receita (self-hosted, opcional)

[Minha Receita](https://github.com/cuducos/minha-receita) é open source e permite consultas CNPJ **sem rate limit** de terceiros.

## Docker Compose (exemplo)

```yaml
# docker-compose.minha-receita.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: receita
      POSTGRES_DB: minhareceita
    volumes:
      - pgdata:/var/lib/postgresql/data

  minha-receita:
    image: cuducos/minha-receita:latest
    ports:
      - "8100:8000"
    environment:
      DATABASE_URL: postgres://postgres:receita@postgres:5432/minhareceita
    depends_on:
      - postgres

volumes:
  pgdata:
```

## Configurar no AFS

```bash
export MINHA_RECEITA_URL=http://localhost:8100
```

O cliente `CnpjApiClient` consultará `{MINHA_RECEITA_URL}/cnpj/{cnpj14}` **antes** das APIs públicas.

> Nota: popular o Postgres da Minha Receita exige carga separada dos dados RF (ver documentação upstream).
