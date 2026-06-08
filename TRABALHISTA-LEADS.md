# Leads Trabalhistas (Justiça do Trabalho)

Módulo independente: monitora processos na JT, enriquece via CNPJ/QSA (BrasilAPI) e dispara contato (WhatsApp + e-mail).

**Tudo online** — configuração no dashboard, execução via GitHub Actions. Nada roda no seu PC.

## Arquitetura

```
Dashboard React                    GitHub Actions (cron)           Cloud Functions
────────────────                   ─────────────────────           ───────────────
Config → Firestore                 Datajud + BrasilAPI             scoreLeadOnWrite
Kanban + disparo manual            Evolution + SMTP                FCM (score ≥ 70)
        │                                  │                              │
        └──────────── Firestore ───────────┴──────────────────────────────┘
                      leads / outreachQueue / outreachLog / trabalhistaConfig
```

| Componente | Onde roda | HTTP externo |
|------------|-----------|--------------|
| Worker coleta/outreach | GitHub Actions | Sim (Datajud, BrasilAPI, Evolution, SMTP) |
| Cloud Functions | Firebase | Não (só Firestore + FCM) |
| Dashboard | GitHub Pages | Não (Firestore SDK) |

## Configuração online

1. Acesse `/dashboard/trabalhista-leads/`
2. Expanda **Configuração online**
3. Preencha Datajud, Evolution, SMTP, templates
4. Marque **Módulo ativo** e **Salvar**

Dados salvos em `trabalhistaConfig/settings` (somente admin).

### GitHub Secret (único setup fora do dashboard)

No repositório GitHub → **Settings → Secrets → Actions**:

| Secret | Conteúdo |
|--------|----------|
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo da service account Firebase |

Como obter: Firebase Console → Project Settings → Service accounts → Generate new private key.

## Coleções Firestore

| Coleção | Uso |
|---------|-----|
| `trabalhistaConfig/settings` | Configuração online |
| `leads` | Empresas/processos |
| `outreachQueue` | Fila dias 0, 3, 7, 14 + manual |
| `outreachLog` | Histórico de contatos |

## Cron na nuvem

| Workflow | Frequência | Ação |
|----------|------------|------|
| `trabalhista-leads-collect.yml` | A cada 6 h | Varredura Datajud |
| `trabalhista-leads-outreach.yml` | A cada 15 min | Processa fila |

Disparo manual também pelo botão **Disparar** no dashboard.

## Deploy

### Portal (automático)
Push em `main` → GitHub Pages.

### Firestore
```powershell
cd site-de-notas-futurista
npx firebase-tools deploy --only firestore:rules,firestore:indexes
```

### Cloud Functions (Blaze)
```powershell
npx firebase-tools deploy --only functions:scoreLeadOnWrite,functions:normalizeManualOutreach
```

## URLs

- Dashboard: https://linduro.github.io/App-Contabilidade/dashboard/trabalhista-leads/
- Acesso: `cartoonhq@gmail.com`

## Primeiro uso

1. Adicionar secret `FIREBASE_SERVICE_ACCOUNT` no GitHub
2. Deploy rules + portal
3. Abrir dashboard → configurar APIs → ativar módulo
4. Actions → rodar manualmente **Trabalhista Leads — Coleta** para testar
