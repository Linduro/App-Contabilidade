# Guia de Prospecção — Base Lucro Real (~230k)

## O que você vai extrair da Receita Federal

Para cada empresa **Lucro Real** candidata, o sistema guarda:

| Campo | Fonte RF |
|-------|----------|
| **CNPJ** (básico + matriz 14 dígitos) | Empresas + Estabelecimentos |
| **Endereços oficiais** | Todos os estabelecimentos ativos (matriz + filiais) |
| **Pessoas-chave** | Tabela Sócios (administradores, diretores, presidentes) |
| **E-mails** | Cadastro RF por estabelecimento + e-mail da matriz |
| **CNAEs** | Principal + secundários + descrição textual |
| **Telefone matriz** | Estabelecimento matriz |
| **Capital social, porte, cluster** | Empresas + classificação AFS |

---

## Duas formas de usar

### 1. Consulta rápida (BrasilAPI) — testes e poucos CNPJs

- Menu **Prospecção** → seção BrasilAPI
- 1 CNPJ ou lote pequeno (~50/dia com rate limit)
- Ideal para validar antes da carga em massa

### 2. Base completa (~230k) — pipeline Python

```bash
cd afs-market-intelligence
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
# → http://localhost:5001
```

No app: **Prospecção** → **Iniciar ingestão completa RF**

Ou via API:

```bash
curl -X POST http://localhost:5001/api/rf/ingest \
  -H "Content-Type: application/json" \
  -d "{\"modo\": \"completo\", \"skip_download\": false}"
```

Acompanhe: `GET /api/jobs/{id}`

---

## Modos de filtro

| Modo | Empresas | Uso |
|------|----------|-----|
| `completo` | ~230k+ | Toda base Lucro Real qualificada |
| `icp_afs` | ~40–80k | Só Agro / Indústria / Varejo (ICP AFS) |

---

## Critérios Lucro Real (proxy RF)

1. **Não** está no Simples Nacional ativo
2. Capital social ≥ R$ 2.000.000
3. Natureza jurídica: Ltda ou S/A
4. Situação cadastral ativa
5. Mais de 3 estabelecimentos

---

## Tempo e infraestrutura

| Etapa | Tempo estimado |
|-------|----------------|
| Download ZIPs RF | 20–40 min |
| Carga DuckDB | 15–30 min |
| Montagem base prospectos | 5–15 min |
| **Total primeira vez** | **45–90 min** |

Requisitos: **2 GB RAM**, **~15 GB disco**, Cloud Run ou máquina local.

---

## Próximos passos após a base

1. **Importar amostra** → botão na UI (200 top scores)
2. **Enriquecimento web** → Google/LinkedIn para CFO/Controller
3. **Validação e-mail** → MX + SMTP ping
4. **Export Excel** → abordagem manual
5. **Dead Zone** → LinkedIn/telefone para quem não tem e-mail

---

## Endpoints úteis

| GET/POST | Rota |
|----------|------|
| GET | `/api/rf/status` |
| POST | `/api/rf/ingest` |
| GET | `/api/prospectos?uf=SP&limite=100` |
| GET | `/api/prospectos/{cnpj_basico}` |
| GET | `/api/jobs/{id}` |
