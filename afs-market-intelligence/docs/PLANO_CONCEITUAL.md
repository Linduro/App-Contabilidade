# AFS Market Intelligence — Plano Conceitual de Arquitetura

> Asset Flow Solutions (AFS) · Motor de Inteligência de Mercado B2B  
> Conformidade patrimonial (CPCs 27, 01, 46 · ABNT 14.653) · Modelo híbrido coparticipativo

---

## 1. Propósito Central

A AFS elimina o custo crônico de headcount interno e laudos anuais tradicionais, entregando **conformidade e inteligência patrimonial continuada** para empresas de Lucro Real. O motor de dados existe para alimentar uma abordagem comercial **manual, cirúrgica e de alta conversão** — não automação de cold email em massa.

A plataforma é **adaptável por perfil de uso**: o núcleo ICP padrão foca controle patrimonial, mas sócios e parceiros podem configurar filtros, clusters e scoring para outros propósitos (M&A, crédito, supply chain, prospecção genérica).

---

## 2. Visão em Camadas

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 5 — Feedback Loop & Recalibração de Scoring                    │
│  Respostas comerciais → ajuste de cluster, ICP e prioridade futura     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 4 — Funil Comercial & Acompanhamento Humano                    │
│  Export Excel · CRM manual · registro de touchpoints                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 3 — Higienização & Anti-Bounce (+ Dead Zone)                   │
│  Formato → MX → SMTP Ping → roteamento alternativo                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 2 — Enriquecimento & Raspagem de Decisores                     │
│  LinkedIn (confirmar/preencher) · Google · governança corporativa       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 1 — Ingestão & Categorização (Origem Governamental)            │
│  Receita Federal · DuckDB em disco · ICP · Clusters estratégicos       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
┌─────────────────────────────────────────────────────────────────────────┐
│  CAMADA 0 — Monitores Transversais                                   │
│  Transição Presumido→Lucro Real · Parcerias B2B2B (bancas médias)      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Camada 1 — Ingestão e Categorização (Origem Governamental)

### 3.1 Fonte primária

Automatizar extração das tabelas públicas do **Portal de Dados Abertos da Receita Federal**:

| Tabela | Conteúdo relevante |
|--------|-------------------|
| EMPRESAS | CNPJ básico, razão social, capital social, porte, natureza jurídica |
| ESTABELECIMENTOS | Matriz/filiais, CNAE, UF/município, situa cadastral, telefone |
| CNAEs | Descrição e hierarquia de atividades econômicas |

Arquivos ZIP mensais (~GB) devem ser baixados incrementalmente e processados **direto em disco** via **DuckDB** (primário) ou SQLite (fallback), evitando carregar datasets inteiros em RAM.

### 3.2 Pipeline de ingestão

1. **Download incremental** — detectar versão mais recente disponível; manter histórico versionado localmente.
2. **Staging em disco** — descompactar para diretório `data/rf/raw/`; registrar checksum e data de referência.
3. **Carga DuckDB** — `CREATE TABLE AS SELECT` a partir de CSV com tipagem explícita; índices em CNPJ, CNAE, UF.
4. **Join empresas ↔ estabelecimentos ↔ CNAEs** — view materializada `vw_empresas_enriquecidas`.
5. **Snapshot mensal** — permite comparar estados entre meses (base do monitor de regime).

### 3.3 Filtro ICP AFS (Lucro Real qualificado)

Isolar aproximadamente **~230 mil empresas** que compõem o universo endereçável:

| Critério | Regra | Justificativa comercial |
|----------|-------|-------------------------|
| Regime | Lucro Real (ou sinais compatíveis) | Obrigatoriedade CPC/ABNT |
| Capital social | ≥ R$ 2.000.000 | Capacidade de pagamento e complexidade patrimonial |
| CNAE | Lista obrigatória por cluster | Fit operacional da AFS |
| Rede | > 3 filiais ativas | Dispersão de ativos, dor de controle patrimonial |

Regime tributário exato nem sempre está explícito na RF; usar **proxy composto**: porte, natureza jurídica, capital, CNAE de alto faturamento e histórico de snapshots. O **Monitor de Transição** (Camada 0) refina isso ao longo do tempo.

### 3.4 Categorização por cluster estratégico

Cada CNPJ aprovado recebe coluna `cluster_estrategico`:

| Cluster | Foco AFS | Sinais de dor |
|---------|----------|---------------|
| **Agro** | Ativos biológicos, maquinário disperso, CPC 27 | CNAEs 01.xx–03.xx, múltiplas fazendas/unidades rurais |
| **Indústria** | Auditoria CPC 01/27, laudos de imobilizado | CNAEs 10.xx–33.xx, alto CAPEX, plantas múltiplas |
| **Varejo** | Furos de estoque/imobilizado multi-loja | CNAEs 47.xx, >5 PDVs, capital de giro elevado |

Clusters são **configuráveis por perfil** (`config/profiles.yaml`) para uso genérico além da AFS.

### 3.5 Governança da Camada 1

- Dados públicos: sem LGPD sobre pessoa jurídica, mas respeitar termos de uso da RF.
- Logs de proveniência: toda linha exportada carrega `fonte`, `versao_rf`, `data_extracao`.
- Retenção: snapshots por 24 meses; dados processados indefinidamente com versionamento.

---

## 4. Camada 2 — Enriquecimento e Raspagem Comercial

### 4.1 Objetivo

Transformar CNPJs filtrados em **mapas de decisão** com personas:

- **CFO / Diretor Financeiro**
- **Controller**
- **Gerente Contábil**

### 4.2 LinkedIn: confirmar vs. preencher

O LinkedIn opera em **dois modos complementares**, nunca como fonte única cega:

| Modo | Quando usar | Ação |
|------|-------------|------|
| **Confirmar** | Nome/cargo encontrado em Google, site ou CVM | Buscar perfil; validar empresa, cargo e tenure; elevar score de confiança |
| **Preencher** | Cargo crítico ausente nos dados primários | Busca por empresa + cargo; extrair nome; marcar como `origem=linkedin_discovery` |

Regra de ouro: **dado primário (site/CVM) prevalece**; LinkedIn eleva confiança ou preenche lacuna. Conflitos geram flag `requer_revisao_humana`.

### 4.3 Fontes de enriquecimento

1. **Site corporativo** — páginas "Sobre", "Governança", "Investidores".
2. **Google Search** — queries estruturadas: `"{razao_social}" CFO OR "diretor financeiro"`.
3. **LinkedIn** — confirmação/preenchimento conforme acima.
4. **CVM / RI** — empresas abertas ou emissores de dívida.
5. **Receita Federal** — telefone e e-mail cadastral da matriz (fallback Dead Zone).

### 4.4 Organograma inferido

Construir grafo leve:

```
Empresa (CNPJ)
  ├── CFO (confiança: alta/média/baixa)
  ├── Controller
  ├── Gerente Contábil
  └── Sócios-administradores (RF)
```

Cada nó carrega: nome, cargo, fontes[], score_confiança, linkedin_url (se houver).

### 4.5 Rate limiting e ética

- Respeitar robots.txt e intervalos entre requisições.
- Sem automação de mensagens LinkedIn — apenas coleta para abordagem humana posterior.
- Registrar timestamp e fonte de cada dado enriquecido.

---

## 5. Camada 3 — Higienização de Contatos e Anti-Bounce

### 5.1 Fluxo de validação de e-mail

```
E-mail encontrado
    │
    ▼
[1] Validação de formato (RFC 5322 simplificado)
    │ inválido → descartar + log
    ▼
[2] Checagem MX do domínio corporativo
    │ sem MX → Dead Zone (ver §6)
    ▼
[3] Algoritmo SMTP Ping (sem enviar mensagem)
    │   ├── 250/251 → caixa provavelmente existe
    │   ├── 550/551 → caixa inexistente → Dead Zone
    │   └── catch-all detectado → flag `catch_all=true`, confiança reduzida
    ▼
[4] Classificação final
    ├── validado_alta
    ├── validado_media (catch-all)
    ├── invalido
    └── pendente (timeout/ greylisting)
```

### 5.2 Anti-bounce como blindagem de reputação

A abordagem AFS é 100% manual no primeiro contato. Mesmo assim, validar antes evita:

- Perda de credibilidade do remetente pessoal
- Sinal de spam para domínios corporativos
- Tempo comercial desperdiçado

E-mails `validado_alta` entram na planilha principal. `validado_media` entram com alerta visual. `invalido` e `pendente` vão para Dead Zone.

### 5.3 Export consolidado

Arquivo Excel final com abas:

| Aba | Conteúdo |
|-----|----------|
| Leads Prontos | E-mails validados + decisores + cluster + score |
| Dead Zone | Leads sem e-mail validado + rotas alternativas |
| Transição Regime | Empresas migrando Presumido→Lucro Real |
| Parceiros B2B2B | Bancas de auditoria média para canal reverso |
| Metadados | Versão RF, data pipeline, perfil ICP usado |

---

## 6. Dead Zone — Plano B para Leads sem E-mail Validado

Leads que completaram ingestão + enriquecimento mas **não possuem e-mail validado** não são descartados. Entram na **Dead Zone** com roteamento alternativo prioritizado:

### 6.1 Árvore de decisão Dead Zone

```
Sem e-mail validado
    │
    ├─[A] LinkedIn do decisor confirmado?
    │      SIM → Prioridade 1: abordagem InMail/mensagem manual LinkedIn
    │      NÃO ↓
    │
    ├─[B] Telefone da matriz (RF) disponível?
    │      SIM → Prioridade 2: ligação fria qualificada (script por cluster)
    │      NÃO ↓
    │
    ├─[C] Endereço físico da matriz?
    │      SIM → Prioridade 3: carta/email genérico contato@ + visita presencial regional
    │      NÃO ↓
    │
    └─[D] Indicação via parceiro B2B2B?
           SIM → Prioridade 4: warm intro pela banca de auditoria
           NÃO → Arquivo "Revisão Manual" com score baixo
```

### 6.2 Campos Dead Zone na exportação

- `rota_recomendada`: linkedin | telefone | endereco | parceiro | revisao
- `linkedin_url_decisor`
- `telefone_matriz`
- `endereco_completo`
- `motivo_dead_zone`: sem_email | mx_ausente | smtp_rejeitado | catch_all_only
- `prioridade`: 1–5

### 6.3 Reentrada no funil

Se o comercial obtiver e-mail válido via LinkedIn ou ligação, registra no sistema → lead **reprocessa Camada 3** → migra de Dead Zone para Leads Prontos.

---

## 7. Camada 5 — Feedback Loop e Recalibração

O sistema deixa de ser mão única quando o time comercial registra outcomes:

### 7.1 Eventos de feedback

| Outcome | Código | Efeito no scoring |
|---------|--------|-------------------|
| Resposta positiva | `positivo` | +peso em cluster, CNAE, porte e fonte de enriquecimento |
| Resposta negativa | `negativo` | −peso; registrar motivo (timing, fit, concorrência) |
| Sem resposta | `sem_resposta` | neutro inicial; após N tentativas, −peso leve |
| Reunião agendada | `reuniao` | +++ peso máximo no perfil similar |
| Indicação parceiro | `indicacao_b2b2b` | +peso em canal parceiro e segmento |

### 7.2 Recalibração automática

Periodicamente (semanal):

1. Agrupar leads por `cluster × CNAE × capital × UF × fonte_decisor`.
2. Calcular taxa de conversão por grupo.
3. Ajustar `score_prioridade` futuro: leads similares aos grupos de alta conversão sobem no ranking.
4. Clusters com taxa negativa persistente → alerta para revisão de ICP ou messaging.

### 7.3 Aprendizado LinkedIn

- Perfis confirmados via LinkedIn que converteram → aumentar peso de `linkedin_confirmado`.
- Cargos descobertos via LinkedIn que falharam → revisar heurística de busca.

### 7.4 Multi-perfil

Cada perfil de uso (`patrimonial`, `generico`, `credito`, etc.) mantém **matriz de scoring independente**, permitindo que o sócio use a mesma base sem contaminar o ICP AFS.

---

## 8. Monitor de Empresas em Transição de Regime

### 8.1 Por que é o lead mais quente

Empresas migrando de **Lucro Presumido → Lucro Real**:

- Ainda **não possuem** processo de conformidade patrimonial estruturado
- CFO em **modo reestruturação** (aberto a soluções)
- Janela de 3–6 meses antes da concorrência perceber

### 8.2 Detecção automatizada

Comparar snapshots mensais RF:

```
Mês M-1: proxy_regime = PRESUMIDO (ou indeterminado_baixo)
Mês M:   proxy_regime = LUCRO_REAL (capital↑, porte↑, CNAE, QSA)
         → EVENTO: transicao_regime
```

Sinais auxiliares:

- Aumento abrupto de capital social
- Mudança de natureza jurídica (LTDA→S/A)
- Novo estabelecimento matriz em UF diferente
- Inclusão em base de empresas abertas CVM

### 8.3 Ação comercial

- Flag `lead_quente_transicao` com prioridade máxima no export
- Alerta push/e-mail interno ao time AFS
- Script de abordagem específico: "primeira conformidade patrimonial pós-migração"

Defasagem RF de 3–6 meses é conhecida; combinar com sinais alternativos (notícias, RI, vagas de Controller).

---

## 9. Parceria Reversa B2B2B — Bancas de Auditoria Média

### 9.1 Lógica do canal

Bancas independentes (fora das 10 maiores) auditam clientes, encontram **problemas de avaliação patrimonial** e frequentemente **não têm serviço para resolver**. A AFS:

- Resolve o problema técnico (CPC 27/01/46)
- Mantém o auditor como herói perante o cliente
- Ticket e conversão superiores por **trust transfer**

### 9.2 Operacionalização

1. Base de bancas médias cadastrada (`data/audit_firms.json`) — exclui Big Four + top 6 globais.
2. Para cada lead AFS, cruzar **auditor do cliente** (DFP/CVM quando disponível) com base de parceiros.
3. Funil B2B2B separado: contato com sócio da banca → acordo de indicação → co-abordagem.
4. Feedback `indicacao_b2b2b` alimenta scoring do canal.

### 9.3 Governança

- Sem conflito com Big Four (não são alvo)
- NDAs e acordos formais por banca
- Rastreio de origem em todo lead convertido via parceiro

---

## 10. Funil Comercial e Acompanhamento

### 10.1 Estágios do funil

```
Universo RF (~230k ICP)
    → Enriquecido (~40k com decisor)
    → E-mail validado (~15k)
    → Abordado manualmente
    → Resposta
    → Reunião
    → Proposta
    → Cliente AFS
```

Dead Zone e Transição Regime são **rotas paralelas** que reentram no funil.

### 10.2 Princípios operacionais

- **Zero automação de primeiro contato por e-mail** — personalização extrema
- Cada touchpoint registrado retroalimenta scoring
- Export Excel é o artefato de trabalho diário do comercial
- Dashboard web para status do pipeline e monitores

---

## 11. Blindagem de Governança

| Área | Controle |
|------|----------|
| Dados RF | Uso conforme licença aberta; sem redistribuição comercial dos brutos |
| Scraping | Rate limit, logs, robots.txt |
| LGPD | Dados de decisores = tratamento com base legítima B2B; direito de oposição |
| E-mail validation | SMTP ping passivo; sem conteúdo enviado |
| Multi-usuário | Perfis ICP isolados; auditoria de exportações |
| Segurança | API keys em env; sem credenciais em repo |

---

## 12. Evolução da Plataforma

A arquitetura suporta **perfis de busca genéricos** além do ICP patrimonial:

- `patrimonial` — configuração AFS padrão
- `generico` — filtros livres por CNAE/UF/capital
- `transicao_regime` — monitor dedicado
- `parceiros_auditoria` — funil B2B2B
- Custom — sócio define YAML próprio

Todos compartilham a mesma infraestrutura DuckDB + pipeline, diferenciando apenas regras e scoring.

---

*Documento conceitual v1.0 · AFS Market Intelligence · Asset Flow Solutions*
