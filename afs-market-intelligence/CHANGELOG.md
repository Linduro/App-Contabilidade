# AFS Market Intelligence — Changelog

Refatoração completa da plataforma de prospecção B2B (Asset Flow Solutions).

## Bloco 1 — Firebase

- `js/firebase-config.js`: SDK modular v10, `db` + `auth`, config via `window.__AFS_FB_CONFIG__`
- `js/browser-api.js`: `window.AFSMarketAPI` migrado para Firestore (leads, historico_contato, parceiros, configuracoes)
- `firestore.rules`: leitura/escrita autenticada; delete apenas admin

## Bloco 2 — Dashboard

- 6 KPIs em tempo real com variação % mensal
- Distribuição por regime tributário (barras CSS)
- Top 5 CNAEs e Oportunidades do Dia
- Arquitetura em camadas colapsável

## Bloco 3 — Leads ICP

- Filtros avançados, paginação 25/página, skeleton loading
- Tabela expandida com colunas de ações
- Drawer lateral 420px com dados cadastrais, sócios e histórico

## Bloco 4 — Pipeline

- Painel visual de etapas com status e progresso
- Configuração persistida em `configuracoes/pipeline`

## Bloco 5 — Funil Kanban

- 6 colunas com drag-and-drop HTML5
- Métricas de conversão e barras por etapa
- Registro automático em `historico_contato`

## Bloco 6 — Dead Zone

- Filtros por rota, prioridade e motivo
- Botão Reativar com atualização reativa

## Bloco 7 — Transição de Regime

- Card destaque 90 dias, colunas extras, botão Priorizar

## Bloco 8 — Parceiros B2B2B

- Cadastro modal, acionamento com briefing e histórico B2B2B

## Bloco 9 — Export

- CSV, JSON, área de transferência e Excel (SheetJS) client-side
- Seleção de colunas e status do funil

## Bloco 10 — UX

- Status online/offline, ícones no menu, toasts, perfil no header
- Busca global, responsividade mobile/tablet, tela Configurações com scoring

## Bloco 11 — Segurança

- Login Firebase Email/Senha antes de renderizar a SPA
- Regras Firestore e tratamento de erros `[AFS-ERROR]`

## Pós-refatoração

- Bootstrap async: `config.json` carregado antes dos módulos ES (corrige race condition)
- Filtro `isAfsMarketLead()` isola leads B2B dos leads trabalhistas na mesma coleção
- Regras mescladas em `site-de-notas-futurista/firestore.rules` e deployadas
- Script `scripts/seed-firestore.mjs` para dados de demonstração
- `static/config.json.example` para configuração sem expor credenciais no repo
- `npm run afs:setup` — provisiona `cartoonhq@gmail.com` e `gabrieldouran@gmail.com`

## Fechamento de lacunas (blocos 3–5, 7, 10)

- **Bloco 4:** Config pipeline completa (UF/regimes multi, CNAE tags, capital mín., toggles), progresso visual com timestamps e barras %
- **Bloco 5:** Tempo médio por etapa do funil via `historico_contato`
- **Bloco 3:** Drawer com localização, sócios, links clicáveis, badge de status
- **Bloco 7:** Tabela de transição restrita aos últimos 90 dias
- **Bloco 10:** `data-label` nas células para responsividade mobile

## 100% do plano (fechamento final)

- **Bloco 1:** `schemas.js` com validação de payloads e enums das coleções
- **Bloco 3:** Porte MEI–Grande, score máx., drawer completo
- **Bloco 4:** Execução por etapa individual + animação de progresso
- **Bloco 5:** Tempo médio entre transições no histórico (por lead)
- **Bloco 8:** Botão Editar parceiro + e-mail/telefone no modal
- **Bloco 11:** Admin por e-mail nas rules (plano Spark, sem Blaze) + `[AFS-ERROR]` em todos os catches
- **CI:** workflows Cloud Run ignoram deploy quando `ENABLE_GCP_CLOUD_RUN` ≠ `true` (variável do repositório)

## v3 — Casca Leads2b (fase 2)

- Nova shell: sidebar colapsável, header, busca global, roteamento hash `#/rota`
- `store.js` + `localStorage` como fonte padrão; seed com dados contábeis fictícios
- Import único do Firestore na primeira carga (`firestore-adapter.js`)
- UI legada em `#/legacy` (`static/legacy/page.html` + `js/legacy/app.js`)
- Módulo Home `#/apps` com cards de onboarding e oportunidades do dia

## v3.1 — CRM Pipelines (fase 3a)

- `#/crm/pipelines`: Kanban SortableJS, drag entre etapas, visão lista
- Modal **Novo Negócio**, drawer de detalhe, Pipe Metrics
- `#/crm/oportunidades`: 6 cards-resumo + tabela de oportunidades ativas
- Sincroniza etapa do negócio com `status_funil` do lead

## v3.2 — CRM Leads (fase 3b)

- `#/crm/leads`: caixa de entrada com filtros, paginação 25, seleção em massa
- Drawer de lead, ações funil/contato/criar negócio
- Importar CSV, exportar CSV/JSON/Copiar/Excel
- Modal **+ Novo lead**
