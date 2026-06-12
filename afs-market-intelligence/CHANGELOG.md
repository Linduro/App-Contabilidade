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
