# Leads Trabalhistas

Módulo de coleta de empresas processadas sem advogado via **Datajud (CNJ)**.

## Arquitetura

```
GitHub Actions (agent/)  →  Datajud + BrasilAPI  →  Firestore (leads)
Dashboard React          →  Firestore (leads + filtros regionais)
Cloud Functions          →  scoreLeadOnWrite + FCM para score ≥ 70
```

| Componente | Onde roda | Secrets |
|------------|-----------|---------|
| Coleta | `trabalhista-leads-collect.yml` | `FIREBASE_SERVICE_ACCOUNT`, `DATAJUD_API_KEY` |
| Scoring | Cloud Function | — |
| Filtros regionais | Dashboard → `userSettings/{uid}/filters/trabalhista` | — |

Configuração do worker via **variáveis de ambiente** (sem painel Firestore):

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DATAJUD_API_KEY` | — | Obrigatória |
| `DATAJUD_TRTS` | `1,2,3,15` | TRTs monitorados |
| `DATAJUD_DAYS_BACK` | `7` | Janela retroativa |
| `WORKER_ENABLED` | `true` | Liga/desliga coleta trabalhista |
| `COLLECT_ENABLED` | `true` | Coleta Datajud |
| `EXECUCOES_ENABLED` | `true` | Coleta execuções rurais |
| `EXECUCOES_DAYS_BACK` | `14` | Janela execuções rurais |

## Firestore

| Coleção | Uso |
|---------|-----|
| `leads` | Leads trabalhistas |
| `userSettings/{uid}/filters/trabalhista` | Filtros regionais independentes |

## Dashboard

Rota: `/dashboard/trabalhista-leads/` (somente admin).

- Kanban + tabela com score, comarca, valor
- Filtros regionais na sidebar (independentes dos outros módulos)
- Status manual: novo → contatado → respondeu → cliente
