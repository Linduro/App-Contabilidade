# Sistema de Prospecção Automatizado (LinkedIn + Instagram)

Extração semi-automatizada de perfis para CSV, Google Sheets ou DuckDB (AFS).

## Aviso legal

LinkedIn e Instagram **proíbem scraping automatizado** nos Termos de Uso. Use conta secundária, delays humanos, volumes baixos e apenas para fins autorizados. Você é responsável pelo uso.

## Instalação

```bash
cd prospect-automation
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
playwright install chromium
copy .env.example .env          # preencher credenciais
```

## Configuração (.env)

```env
LINKEDIN_EMAIL=seu@email.com
LINKEDIN_PASSWORD=sua_senha
INSTAGRAM_USERNAME=              # opcional — perfis públicos funcionam sem login
INSTAGRAM_PASSWORD=
GOOGLE_SHEETS_CREDENTIALS=       # caminho para credentials.json (opcional)
GOOGLE_SHEET_ID=
PROXY_URL=                       # opcional: http://user:pass@host:port
```

## Uso

### Lista manual (main.py)

Edite `targets.json` ou passe CSV:

```bash
python main.py --linkedin urls.txt --instagram users.txt
python main.py --csv targets.example.csv
```

### Integração AFS (API)

```bash
curl -X POST http://localhost:5001/api/social/scrape \
  -H "Content-Type: application/json" \
  -d '{"linkedin_urls":["https://linkedin.com/in/exemplo"],"instagram_users":["marca1"]}'
```

## Estrutura

| Arquivo | Função |
|---------|--------|
| `main.py` | Orquestrador |
| `linkedin_scraper.py` | Playwright + login LinkedIn |
| `instagram_scraper.py` | Instaloader |
| `config.py` | Credenciais / proxies |
| `save_to_sheets.py` | CSV + Google Sheets |
| `targets.example.csv` | Exemplo de alvos |

## Saída

- `output/leads_YYYYMMDD_HHMMSS.csv`
- Tabela DuckDB `social_leads` (quando via API AFS)
