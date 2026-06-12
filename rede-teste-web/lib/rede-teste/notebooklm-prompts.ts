/** Modelos de prompt para colar no assistant (sem API — fluxo manual). */

export type assistantPrompt = {
  id: string;
  title: string;
  area: string;
  description: string;
  prompt: string;
};

export const assistant_URL = "https://assistant.google.com";

export const assistant_PROMPTS: assistantPrompt[] = [
  {
    id: "inicial-peticao",
    title: "Petição inicial",
    area: "Cível",
    description: "Rascunho estruturado a partir dos fatos e documentos do notebook.",
    prompt: `Com base APENAS nos documentos deste notebook, elabore uma PETIÇÃO INICIAL em português brasileiro.

Estrutura obrigatória:
1) Endereçamento e qualificação das partes (use placeholders [NOME], [CPF/CNPJ] se faltar dado)
2) Dos fatos (cronologia objetiva, sem retórica)
3) Do direito (fundamentação enxuta com referência a artigos/leis citados nos documentos)
4) Dos pedidos (lista clara e numerada)
5) Do valor da causa e requerimentos finais

Regras:
- Não invente fatos, números de processo ou jurisprudência que não estejam nos documentos
- Marque trechos incertos com [VERIFICAR]
- Tom formal, terceira pessoa`,
  },
  {
    id: "contestacao",
    title: "Contestação",
    area: "Cível",
    description: "Impugnação ponto a ponto da inicial.",
    prompt: `Analise a petição inicial nos documentos e redija uma CONTESTAÇÃO.

Organize por: preliminares (se houver), mérito (impugnação fato a fato), pedidos finais.

Cite somente provas e argumentos sustentados pelos anexos. Onde faltar prova, indique [PRODUZIR PROVA].`,
  },
  {
    id: "manifestacao-intermediaria",
    title: "Manifestação intermediária",
    area: "Processual",
    description: "Petição de andamento para cumprir despacho/decisão.",
    prompt: `Com base APENAS nos documentos do notebook, redija MANIFESTAÇÃO INTERMEDIÁRIA.

Objetivo:
- Cumprir o último despacho/decisão identificado nos autos
- Informar providências já adotadas
- Requerer o próximo andamento processual adequado

Regras:
- Não invente fato processual, prazo, movimentação ou documento
- Onde faltar informação essencial, sinalize [VERIFICAR NO PROCESSO]
- Texto objetivo, com pedidos finais claros.`,
  },
  {
    id: "replica",
    title: "Réplica à contestação",
    area: "Cível",
    description: "Resposta às preliminares e ao mérito da contestação.",
    prompt: `Com base APENAS na inicial, contestação e anexos do notebook, redija RÉPLICA.

Estrutura:
1) Síntese da defesa
2) Impugnação das preliminares
3) Impugnação do mérito ponto a ponto
4) Reiteração de pedidos e provas

Regras:
- Não inventar jurisprudência, fatos ou documentos
- Destacar contradições da defesa quando houver
- Marcar lacunas com [A COMPROVAR].`,
  },
  {
    id: "embargos-declaracao",
    title: "Embargos de declaração",
    area: "Recursos",
    description: "Correção de omissão, contradição, obscuridade ou erro material.",
    prompt: `Com base APENAS na decisão/sentença e demais documentos do notebook, redija EMBARGOS DE DECLARAÇÃO.

Identifique:
- Omissão
- Contradição
- Obscuridade
- Erro material

Pedidos:
- Saneamento dos vícios apontados
- Efeitos modificativos apenas se tecnicamente cabíveis com base nos documentos

Regras:
- Não inventar fundamento, precedente ou dispositivo legal não presente.`,
  },
  {
    id: "agravo-instrumento",
    title: "Agravo de instrumento",
    area: "Recursos",
    description: "Impugnação de decisão interlocutória.",
    prompt: `Com base APENAS nos documentos do notebook, redija minuta de AGRAVO DE INSTRUMENTO.

Inclua:
- Síntese da decisão agravada
- Cabimento e tempestividade (somente com dados documentados)
- Razões de reforma
- Pedido de efeito suspensivo/ativo se houver suporte documental
- Requerimentos finais

Regras:
- Não presumir peças obrigatórias; indicar [ANEXAR] quando faltar.`,
  },
  {
    id: "cumprimento-sentenca",
    title: "Cumprimento de sentença",
    area: "Execução",
    description: "Requerimento de início de fase executiva.",
    prompt: `Com base APENAS na sentença/acórdão e documentos do notebook, redija PETIÇÃO DE CUMPRIMENTO DE SENTENÇA.

Inclua:
- Título executivo e trânsito/condição de exigibilidade (se constar)
- Demonstrativo de débito (se houver base)
- Requerimentos executivos cabíveis

Regras:
- Se faltar memória de cálculo, marcar [APRESENTAR CÁLCULO].`,
  },
  {
    id: "impugnacao-cumprimento",
    title: "Impugnação ao cumprimento",
    area: "Execução",
    description: "Defesa na fase de cumprimento de sentença.",
    prompt: `Com base APENAS nos documentos do notebook, redija IMPUGNAÇÃO AO CUMPRIMENTO DE SENTENÇA.

Estruture:
- Síntese da execução
- Matérias de defesa com suporte documental
- Itens de cálculo controvertidos (quando houver)
- Pedidos

Regras:
- Não criar fatos financeiros não documentados.`,
  },
  {
    id: "peticao-juntada-documentos",
    title: "Juntada de documentos",
    area: "Processual",
    description: "Petição simples para juntada e ciência do juízo.",
    prompt: `Com base APENAS nos documentos do notebook, redija PETIÇÃO DE JUNTADA DE DOCUMENTOS.

Inclua:
- Identificação objetiva dos documentos
- Finalidade probatória de cada conjunto documental
- Pedido de regular prosseguimento

Tom: formal, sucinto e técnico.`,
  },
  {
    id: "notificacao-extrajudicial",
    title: "Notificação extrajudicial",
    area: "Extrajudicial",
    description: "Comunicação formal para constituir mora/ciência.",
    prompt: `Com base APENAS nos documentos do notebook, redija NOTIFICAÇÃO EXTRAJUDICIAL.

Inclua:
- Fatos objetivos
- Obrigação esperada da parte notificada
- Prazo para resposta/cumprimento (somente se houver base)
- Consequências jurídicas em linguagem técnica e moderada

Não use ameaças indevidas ou dados não documentados.`,
  },
  {
    id: "contrato-minuta",
    title: "Minuta contratual",
    area: "Contratos",
    description: "Rascunho de contrato com cláusulas essenciais.",
    prompt: `Com base APENAS nos documentos do notebook, elabore MINUTA CONTRATUAL.

Estrutura mínima:
- Partes
- Objeto
- Preço/remuneração (se aplicável)
- Prazo e vigência
- Obrigações e responsabilidades
- Rescisão
- Foro

Onde faltar dado obrigatório, usar placeholders [PREENCHER].`,
  },
  {
    id: "parecer-viabilidade-acao",
    title: "Parecer de viabilidade de ação",
    area: "Consultivo",
    description: "Análise sobre chance de êxito e estratégia.",
    prompt: `Com base APENAS nos documentos do notebook, redija PARECER DE VIABILIDADE DE AÇÃO.

Inclua:
- Questões jurídicas centrais
- Pontos favoráveis e desfavoráveis
- Provas existentes e provas faltantes
- Risco processual (baixo/médio/alto) com justificativa
- Recomendação estratégica objetiva

Não garantir resultado.`,
  },
  {
    id: "recurso-apelação",
    title: "Apelação / razões recursais",
    area: "Recursos",
    description: "Síntese do decisum e teses recursais.",
    prompt: `Com base na sentença/decisão e demais peças do notebook, elabore RAZÕES DE APELAÇÃO.

Inclua: síntese do decisum, prequestionamento, teses numeradas, pedido de reforma.

Não cite súmulas ou acórdãos que não constem nos documentos.`,
  },
  {
    id: "trabalhista-reclamacao",
    title: "Reclamação trabalhista",
    area: "Trabalhista",
    description: "Pedidos e fundamentos a partir de contrato, holerites e mensagens.",
    prompt: `Elabore minuta de RECLAMAÇÃO TRABALHISTA usando somente os documentos do notebook.

Liste: contrato de trabalho, jornada, verbas pleiteadas com memória de cálculo [se houver planilha], pedidos acessórios.

Separe fatos comprovados de hipóteses [A COMPROVAR].`,
  },
  {
    id: "trabalhista-defesa",
    title: "Contestação trabalhista",
    area: "Trabalhista",
    description: "Defesa em reclamação trabalhista com impugnação de pedidos.",
    prompt: `Com base APENAS nos documentos do notebook, redija CONTESTAÇÃO TRABALHISTA.

Inclua:
- Síntese da inicial
- Preliminares cabíveis (se houver base)
- Impugnação específica de cada pedido
- Tópico de jornada/verbas apenas com suporte documental
- Protesto por provas e pedidos finais

Não invente controles de ponto, recibos ou cláusulas inexistentes.`,
  },
  {
    id: "trabalhista-calculos",
    title: "Memória de cálculos trabalhistas",
    area: "Trabalhista",
    description: "Organização de parâmetros e memória de cálculo inicial.",
    prompt: `Com base APENAS nos documentos do notebook, elabore MEMÓRIA DE CÁLCULOS TRABALHISTAS.

Entregue:
- Premissas adotadas
- Verbas analisadas
- Fórmula/critério de cálculo por verba
- Pontos sem base documental marcados como [VERIFICAR BASE]

Não invente valores de salário, período ou jornada.`,
  },
  {
    id: "previdenciario-beneficio",
    title: "Requerimento de benefício previdenciário",
    area: "Previdenciário",
    description: "Minuta para pedido administrativo com base documental.",
    prompt: `Com base APENAS nos documentos do notebook, redija REQUERIMENTO ADMINISTRATIVO DE BENEFÍCIO PREVIDENCIÁRIO.

Inclua:
- Histórico contributivo/segurado (se constar)
- Requisitos identificados e pendências
- Documentos comprobatórios listados
- Pedido final claro

Não invente tempo de contribuição, laudo ou vínculos.`,
  },
  {
    id: "previdenciario-recurso-inss",
    title: "Recurso administrativo no INSS",
    area: "Previdenciário",
    description: "Recurso contra indeferimento administrativo.",
    prompt: `Com base APENAS nos documentos do notebook, redija RECURSO ADMINISTRATIVO PREVIDENCIÁRIO.

Estruture:
- Síntese do indeferimento
- Pontos de inconformismo com base documental
- Requisitos preenchidos x pendências
- Pedido de reforma

Se faltar prova, sinalize [DOCUMENTO A JUNTAR].`,
  },
  {
    id: "criminal-resposta-acusacao",
    title: "Resposta à acusação",
    area: "Criminal",
    description: "Defesa inicial em ação penal.",
    prompt: `Com base APENAS nos documentos do notebook, redija RESPOSTA À ACUSAÇÃO.

Inclua:
- Síntese da denúncia
- Preliminares e nulidades (se houver base)
- Mérito defensivo objetivo
- Rol de diligências/provas defensivas
- Pedido final

Não invente fatos do inquérito ou depoimentos não documentados.`,
  },
  {
    id: "criminal-memoriais",
    title: "Memoriais criminais",
    area: "Criminal",
    description: "Razões finais defensivas/acusatórias com base na instrução.",
    prompt: `Com base APENAS nos documentos do notebook, redija MEMORIAIS CRIMINAIS.

Estrutura:
- Fatos provados
- Análise crítica da prova oral e documental
- Tipicidade, autoria e materialidade (conforme documentos)
- Pedido final

Não cite precedente ou prova fora dos autos do notebook.`,
  },
  {
    id: "tributario-impugnacao-auto",
    title: "Impugnação a auto de infração",
    area: "Tributário",
    description: "Defesa administrativa contra lançamento/autuação.",
    prompt: `Com base APENAS nos documentos do notebook, redija IMPUGNAÇÃO A AUTO DE INFRAÇÃO.

Inclua:
- Síntese da autuação
- Pontos de nulidade/ilegalidade com base documental
- Quadro dos valores discutidos (se houver dados)
- Pedido de cancelamento/revisão

Não invente documentos fiscais ou memória de cálculo.`,
  },
  {
    id: "tributario-recurso-administrativo",
    title: "Recurso tributário administrativo",
    area: "Tributário",
    description: "Razões recursais em processo administrativo fiscal.",
    prompt: `Com base APENAS nos documentos do notebook, redija RECURSO ADMINISTRATIVO TRIBUTÁRIO.

Estruture:
- Decisão recorrida
- Erros apontados
- Fundamentos técnicos com base nos documentos
- Pedido final

Marque lacunas como [COMPLEMENTAR DOCUMENTAÇÃO].`,
  },
  {
    id: "empresarial-nota-societaria",
    title: "Nota jurídica societária",
    area: "Empresarial",
    description: "Análise de risco e governança para decisões societárias.",
    prompt: `Com base APENAS nos documentos do notebook, redija NOTA JURÍDICA SOCIETÁRIA.

Inclua:
- Contexto societário relevante
- Riscos jurídicos e regulatórios
- Pontos de governança
- Recomendações práticas

Não inferir cláusulas de acordo social não anexado.`,
  },
  {
    id: "empresarial-revisao-clausulas",
    title: "Revisão de cláusulas contratuais",
    area: "Empresarial",
    description: "Checklist de risco e sugestão de ajustes de cláusulas.",
    prompt: `Com base APENAS nos documentos do notebook, faça REVISÃO DE CLÁUSULAS CONTRATUAIS.

Entregue:
- Cláusulas sensíveis identificadas
- Risco por cláusula (baixo/médio/alto)
- Sugestão objetiva de redação alternativa

Não criar obrigações que não estejam no escopo documental.`,
  },
  {
    id: "civil-obrigacao-fazer",
    title: "Ação de obrigação de fazer",
    area: "Cível",
    description: "Minuta inicial para compelir cumprimento de obrigação.",
    prompt: `Com base APENAS nos documentos do notebook, redija INICIAL DE OBRIGAÇÃO DE FAZER.

Inclua:
- Fatos e inadimplemento
- Prova documental de obrigação
- Pedido de tutela de urgência (se houver base)
- Pedidos finais

Marque [VERIFICAR] onde faltar elemento essencial.`,
  },
  {
    id: "civil-indenizacao",
    title: "Ação de indenização",
    area: "Cível",
    description: "Estrutura para danos materiais/morais com base documental.",
    prompt: `Com base APENAS nos documentos do notebook, redija INICIAL DE INDENIZAÇÃO.

Estruture:
- Conduta, dano e nexo com base documental
- Danos materiais (se comprovados)
- Dano moral (fundamentação com fatos dos autos)
- Pedidos

Não inventar valores sem suporte documental.`,
  },
  {
    id: "familia-guarda-alimentos",
    title: "Ação de guarda e alimentos",
    area: "Família",
    description: "Minuta para pedidos de guarda/convivência/alimentos.",
    prompt: `Com base APENAS nos documentos do notebook, redija PETIÇÃO DE GUARDA E ALIMENTOS.

Inclua:
- Situação fática familiar
- Necessidade x possibilidade (se houver base)
- Pedido de guarda/convivência
- Pedido de alimentos

Não incluir fatos íntimos não documentados.`,
  },
  {
    id: "familia-divorcio",
    title: "Divórcio consensual/litigioso",
    area: "Família",
    description: "Rascunho de ação ou petição de divórcio.",
    prompt: `Com base APENAS nos documentos do notebook, redija PETIÇÃO DE DIVÓRCIO.

Tratar:
- Regime de bens (se constar)
- Partilha (se houver base)
- Guarda/convivência/alimentos, quando aplicável
- Pedidos finais

Marcar [PREENCHER] para dados ausentes.`,
  },
  {
    id: "administrativo-mandado-seguranca",
    title: "Mandado de segurança",
    area: "Administrativo",
    description: "Minuta de MS com direito líquido e certo documentado.",
    prompt: `Com base APENAS nos documentos do notebook, redija MANDADO DE SEGURANÇA.

Estrutura:
- Autoridade coatora
- Ato coator
- Direito líquido e certo comprovado
- Pedido liminar (se houver base)
- Pedidos finais

Sem inventar prova pré-constituída.`,
  },
  {
    id: "resumo-audiencia",
    title: "Roteiro de audiência",
    area: "Audiência",
    description: "Perguntas e checklist para instrução.",
    prompt: `Crie um ROTEIRO DE AUDIÊNCIA (instrução) com base nos documentos.

Inclua: objetivo da audiência, pontos controvertidos, perguntas sugeridas à parte contrária e à testemunha, documentos a destacar, riscos [ATENÇÃO].`,
  },
  {
    id: "quesitos-pericia",
    title: "Quesitos para perícia",
    area: "Probatório",
    description: "Formulação de quesitos técnicos para perito judicial.",
    prompt: `Com base APENAS nos documentos do notebook, elabore QUESITOS PARA PERÍCIA.

Entregue:
- Quesitos principais numerados
- Quesitos complementares
- Itens de esclarecimento técnico objetivo

Evite perguntas genéricas; focar no ponto controvertido demonstrado nos autos.`,
  },
  {
    id: "contrarrazoes-recurso",
    title: "Contrarrazões recursais",
    area: "Recursos",
    description: "Resposta ao recurso da parte contrária.",
    prompt: `Com base APENAS nos documentos do notebook, redija CONTRARRAZÕES AO RECURSO.

Estrutura:
- Síntese do recurso adverso
- Preliminares de inadmissibilidade (se houver base)
- Mérito para manutenção da decisão
- Pedido final de desprovimento

Não criar tese sem apoio documental.`,
  },
  {
    id: "memoriais-finais",
    title: "Memoriais finais",
    area: "Processual",
    description: "Síntese final dos argumentos após instrução.",
    prompt: `Com base APENAS nos documentos e atos de instrução do notebook, redija MEMORIAIS FINAIS.

Inclua:
- Fatos comprovados
- Pontos controvertidos remanescentes
- Valoração da prova oral/documental
- Pedidos finais

Tom persuasivo, mas tecnicamente objetivo.`,
  },
  {
    id: "parecer-interno",
    title: "Parecer / nota interna",
    area: "Consultivo",
    description: "Análise de risco para o cliente.",
    prompt: `Redija um PARECER JURÍDICO OBJETIVO (máx. 2 páginas) com base nos documentos.

Estrutura: consulta, análise, conclusão e recomendações práticas.

Classifique riscos: baixo / médio / alto. Não garanta resultado.`,
  },
  ...buildCatalogPrompts(getCatalogPrompts()),
];

type CatalogSeed = { area: string; title: string };

function getCatalogPrompts(): CatalogSeed[] {
  return [
  { area: "Audiência", title: "Petição de Arrolamento de Testemunhas" },
  { area: "Audiência", title: "Roteiro de Alegações Finais Orais" },

  { area: "Cível", title: "Manifestação sobre o Despacho Saneador" },
  { area: "Cível", title: "Petição de Apresentação de Rol de Testemunhas" },
  { area: "Cível", title: "Termo de Acordo para Homologação Judicial" },
  { area: "Cível", title: "Alegações Finais por Memoriais (Cível)" },
  { area: "Cível", title: "Reconvenção" },
  { area: "Cível", title: "Emenda à Petição Inicial" },
  { area: "Cível", title: "Impugnação ao Valor da Causa" },
  { area: "Cível", title: "Impugnação à Assistência Judiciária Gratuita" },
  { area: "Cível", title: "Petição de Cumprimento de Sentença" },
  { area: "Cível", title: "Impugnação ao Cumprimento de Sentença" },
  { area: "Cível", title: "Petição Inicial de Execução de Título Extrajudicial" },
  { area: "Cível", title: "Embargos à Execução" },
  { area: "Cível", title: "Exceção de Pré-Executividade" },
  { area: "Cível", title: "Embargos de Terceiro" },
  { area: "Cível", title: "Contrarrazões de Apelação" },
  { area: "Cível", title: "Contraminuta ao Agravo de Instrumento" },

  { area: "Consultivo", title: "Contrato de Prestação de Serviços" },
  { area: "Consultivo", title: "Parecer Jurídico (Análise aprofundada de um caso ou risco)" },
  { area: "Consultivo", title: "Memorando Jurídico (Resposta objetiva e interna para clientes ou diretoria)" },

  { area: "Extrajudicial", title: "Notificação Extrajudicial" },
  { area: "Extrajudicial", title: "Contranotificação Extrajudicial" },
  { area: "Extrajudicial", title: "Termo de Confissão de Dívida" },
  { area: "Extrajudicial", title: "Acordo Extrajudicial (Composição Amigável)" },
  { area: "Extrajudicial", title: "Notificação de Cobrança / Inadimplência" },

  { area: "Criminal", title: "Pedido de Relaxamento de Prisão em Flagrante (Para prisões ilegais)" },
  { area: "Criminal", title: "Pedido de Liberdade Provisória (Com ou sem fiança)" },
  { area: "Criminal", title: "Pedido de Revogação de Prisão Preventiva ou Temporária" },
  { area: "Criminal", title: "Requerimento para Instauração de Inquérito Policial (Notitia Criminis)" },
  { area: "Criminal", title: "Pedido de Restituição de Coisa Apreendida" },
  { area: "Criminal", title: "Pedido de Acesso aos Autos do Inquérito Policial (Súmula Vinculante 14)" },
  { area: "Criminal", title: "Requerimento de Diligências à Autoridade Policial" },
  { area: "Criminal", title: "Queixa-Crime (Para ações penais de iniciativa privada, como calúnia e difamação)" },
  { area: "Criminal", title: "Pedido de Absolvição Sumária" },
  { area: "Criminal", title: "Alegações Finais por Memoriais (Razões derradeiras antes da sentença)" },
  { area: "Criminal", title: "Pedido de Desclassificação de Delito (Ex: mudar de tentativa de homicídio para lesão corporal)" },
  { area: "Criminal", title: "Pedido de Habilitação de Assistente de Acusação (Advogado da vítima atuando com o Ministério Público)" },
  { area: "Criminal", title: "Exceção de Incompetência / Litispendência / Ilegitimidade" },
  { area: "Criminal", title: "Defesa Prévia na Lei de Drogas" },
  { area: "Criminal", title: "Manifestação na Fase do Art. 422 do CPP (Júri - Arrolamento de testemunhas e juntada de documentos para o plenário)" },
  { area: "Criminal", title: "Pedido de Progressão de Regime (Fechado para semiaberto, semiaberto para aberto)" },
  { area: "Criminal", title: "Pedido de Livramento Condicional" },
  { area: "Criminal", title: "Pedido de Detração Penal (Abater o tempo de prisão provisória da pena final)" },
  { area: "Criminal", title: "Pedido de Remição de Pena (Por trabalho ou estudo)" },
  { area: "Criminal", title: "Pedido de Saída Temporária" },
  { area: "Criminal", title: "Pedido de Prisão Domiciliar" },

  { area: "Empresarial", title: "Petição inicial de Dissolução Parcial de Sociedade" },
  { area: "Empresarial", title: "Petição inicial de Dissolução Total de Sociedade" },
  { area: "Empresarial", title: "Petição inicial de Apuração de Haveres (Para pagamento do sócio retirante)" },
  { area: "Empresarial", title: "Petição inicial de Exclusão de Sócio (Por quebra de affectio societatis ou falta grave)" },
  { area: "Empresarial", title: "Petição inicial Responsabilidade Civil contra Administrador/Diretor" },
  { area: "Empresarial", title: "Petição inicial Prestação de Contas (Contra administrador)" },
  { area: "Empresarial", title: "Petição inicial Anulatória de Assembleia ou Reunião de Sócios" },
  { area: "Empresarial", title: "Petição Inicial de Recuperação Judicial" },
  { area: "Empresarial", title: "Petição Inicial de Recuperação Extrajudicial" },
  { area: "Empresarial", title: "Pedido de Falência (Com base em impontualidade injustificada ou execução frustrada)" },
  { area: "Empresarial", title: "Pedido de Autofalência" },
  { area: "Empresarial", title: "Pedido de Habilitação de Crédito (Tempestiva ou Retardatária)" },
  { area: "Empresarial", title: "Impugnação / Divergência de Crédito" },
  { area: "Empresarial", title: "Objeção ao Plano de Recuperação Judicial (Pelo credor)" },
  { area: "Empresarial", title: "Pedido de Restituição de Bens em Falência" },
  { area: "Empresarial", title: "Incidente de Classificação de Crédito" },
  { area: "Empresarial", title: "Tutela Cautelar Antecedente de Sustação de Protesto" },
  { area: "Empresarial", title: "Petição inicial de Declaratória de Inexigibilidade de Título de Crédito (Duplicata fria, cheque prescrito, etc.) c/c Cancelamento de Protesto" },
  { area: "Empresarial", title: "Petição inicial de Execução de Título Extrajudicial (Cheque, Duplicata, Nota Promissória)" },
  { area: "Empresarial", title: "Petição inicial de Locupletamento Ilícito (Para cheque prescrito)" },

  { area: "Família", title: "Petição Inicial de Divórcio Consensual" },
  { area: "Família", title: "Petição Inicial de Divórcio Litigioso (com ou sem partilha de bens)" },
  { area: "Família", title: "Petição Inicial Declaratória de Reconhecimento e Dissolução de União Estável" },
  { area: "Família", title: "Petição Inicial de Reconhecimento de União Estável Post Mortem" },
  { area: "Família", title: "Petição Inicial de Alteração de Regime de Bens" },
  { area: "Família", title: "Petição Inicial de Suprimento de Outorga Conjugal / Suprimento de Idade" },
  { area: "Família", title: "Petição Inicial de Medida Cautelar de Separação de Corpos" },
  { area: "Família", title: "Petição Inicial de Cautelar de Arrolamento de Bens" },
  { area: "Família", title: "Petição Inicial de Alimentos (Fixação para filhos ou ex-cônjuge)" },
  { area: "Família", title: "Petição Inicial de Alimentos Gravídicos (Para gestantes)" },
  { area: "Família", title: "Petição Inicial Revisional de Alimentos (Majoração ou Minoração)" },
  { area: "Família", title: "Petição Inicial de Exoneração de Alimentos" },
  { area: "Família", title: "Petição Inicial de Execução de Alimentos pelo Rito da Prisão (Art. 528 do CPC)" },
  { area: "Família", title: "Petição Inicial de Execução de Alimentos pelo Rito da Penhora (Art. 523 do CPC)" },
  { area: "Família", title: "Petição Inicial de Inventário (Judicial)" },
  { area: "Família", title: "Petição Inicial de Investigação de Paternidade c/c Alimentos" },
  { area: "Família", title: "Petição Inicial Negatória de Paternidade" },
  { area: "Família", title: "Petição Inicial Anulatória de Registro Civil (Falsidade ideológica/Adoção à brasileira)" },
  { area: "Família", title: "Petição Inicial Declaratória de Reconhecimento de Paternidade ou Maternidade Socioafetiva" },
  { area: "Família", title: "Justificativa em Execução de Alimentos (Defesa do devedor)" },
  { area: "Família", title: "Petição Inicial de Alvará Judicial (Para levantamento de pequenos valores deixados pelo falecido)" },
  { area: "Família", title: "Manifestação sobre Estudo Psicossocial ou Laudo Pericial (Guarda e Alienação Parental)" },
  { area: "Família", title: "Petição de Juntada de Comprovantes de Pagamento de Pensão Alimentícia" },
  { area: "Família", title: "Pedido de Quebra de Sigilo Bancário e Fiscal (Busca de patrimônio oculto no divórcio)" },
  { area: "Família", title: "Petição de Indicação de Assistente Técnico e Apresentação de Quesitos (Para perícia psicológica ou avaliação contábil de empresas da família)" },
  { area: "Família", title: "Pedido de Prisão Civil do Devedor de Alimentos (No curso da execução)" },
  { area: "Família", title: "Pedido de Desconto de Pensão Alimentícia em Folha de Pagamento (Ofício ao Empregador)" },
  { area: "Família", title: "Termo de Acordo Extrajudicial para Homologação Judicial (Composição no meio do processo)" },
  { area: "Família", title: "Contestação em Divórcio Litigioso (com ou sem reconvenção para partilha)" },
  { area: "Família", title: "Contestação em Alimentos (Justificando a impossibilidade financeira)" },
  { area: "Família", title: "Contestação em Investigação de Paternidade" },
  { area: "Família", title: "Contestação em Modificação de Guarda" },
  { area: "Família", title: "Réplica (Manifestação à Contestação em Vara de Família)" },
  { area: "Família", title: "Justificativa em Execução de Alimentos (Para afastar o decreto de prisão)" },

  { area: "Previdenciário", title: "Petição Inicial de Concessão de Benefício por Incapacidade (Auxílio-Doença / Aposentadoria por Invalidez)" },
  { area: "Previdenciário", title: "Petição Inicial de Concessão de Aposentadoria (Idade, Tempo de Contribuição, Rural, Híbrida, Especial, PCD)" },
  { area: "Previdenciário", title: "Petição Inicial de Concessão de Benefício Assistencial - BPC/LOAS (Idoso ou PCD)" },
  { area: "Previdenciário", title: "Petição Inicial de Concessão de Pensão por Morte (Qualidade de dependente ou segurado)" },
  { area: "Previdenciário", title: "Petição Inicial de Concessão de Salário-Maternidade" },
  { area: "Previdenciário", title: "Petição Inicial de Concessão de Auxílio-Acidente (Natureza previdenciária)" },
  { area: "Previdenciário", title: "Petição Inicial de Restabelecimento de Benefício (Contra alta programada ou cessação indevida)" },
  { area: "Previdenciário", title: "Petição Inicial de Revisão de Benefício Previdenciário" },
  { area: "Previdenciário", title: "Petição Inicial de Mandado de Segurança Previdenciário (Contra a demora na análise administrativa do INSS)" },
  { area: "Previdenciário", title: "Petição Inicial de Averbação de Tempo de Serviço (Sem pedido de concessão imediata)" },
  { area: "Previdenciário", title: "Requerimento Administrativo de Concessão de Benefício (Processo Administrativo)" },
  { area: "Previdenciário", title: "Petição de Cumprimento de Exigência (Processo Administrativo)" },
  { area: "Previdenciário", title: "Requerimento de Averbação de Tempo de Contribuição / Rural / Especial (Processo Administrativo)" },
  { area: "Previdenciário", title: "Requerimento de Processamento de Justificação Administrativa (Processo Administrativo)" },
  { area: "Previdenciário", title: "Recurso Ordinário à Junta de Recursos - JRPS (Processo Administrativo)" },
  { area: "Previdenciário", title: "Recurso Especial à Câmara de Julgamento - CAJ (Processo Administrativo)" },
  { area: "Previdenciário", title: "Requerimento de Revisão de Benefício (Processo Administrativo)" },
  { area: "Previdenciário", title: "Defesa em Apuração de Irregularidade / MOB - Monitoramento Operacional de Benefícios (Processo Administrativo)" },
  { area: "Previdenciário", title: "Pedido de Reabertura de Tarefa / Recurso (Processo Administrativo)" },
  { area: "Previdenciário", title: "Réplica / Manifestação sobre a Contestação do INSS" },
  { area: "Previdenciário", title: "Petição de Indicação de Assistente Técnico e Apresentação de Quesitos (Perícia Médica ou Engenharia/Insalubridade)" },
  { area: "Previdenciário", title: "Manifestação sobre o Laudo Pericial Médico (Impugnação ou concordância)" },
  { area: "Previdenciário", title: "Manifestação sobre o Laudo Pericial Socioeconômico (BPC/LOAS)" },
  { area: "Previdenciário", title: "Petição de Juntada de PPP (Perfil Profissiográfico Previdenciário) e Laudos Complementares" },
  { area: "Previdenciário", title: "Petição de Juntada de Documentação Médica Atualizada (Exames e receituários novos)" },
  { area: "Previdenciário", title: "Pedido de Audiência de Instrução (Especialmente para oitiva de testemunhas de tempo rural ou comprovação de união estável)" },
  { area: "Previdenciário", title: "Recurso Inominado (Juizado Especial Federal - JEF)" },
  { area: "Previdenciário", title: "Contrarrazões ao Recurso Inominado (JEF)" },
  { area: "Previdenciário", title: "Incidente de Uniformização de Interpretação de Lei - PUIL (TNU ou TRU)" },
  { area: "Previdenciário", title: "Recurso de Apelação (Casos de competência delegada ou valores acima de 60 salários)" },
  { area: "Previdenciário", title: "Petição de Cumprimento de Sentença contra o INSS / Fazenda Pública (Para requisição de RPV ou Precatório)" },
  { area: "Previdenciário", title: "Petição de Destaque de Honorários Contratuais (Juntada do contrato antes da expedição do RPV/Precatório)" },
  { area: "Previdenciário", title: "Manifestação sobre os Cálculos da Contadoria Judicial (Concordância ou divergência dos atrasados)" },

  { area: "Trabalhista", title: "Petição Inicial de Reclamação Trabalhista" },
  { area: "Trabalhista", title: "Petição Inicial de Rescisão Indireta do Contrato de Trabalho" },
  { area: "Trabalhista", title: "Petição Inicial de Reconhecimento de Vínculo Empregatício" },
  { area: "Trabalhista", title: "Petição Inicial de Indenização por Acidente de Trabalho ou Doença Ocupacional" },
  { area: "Trabalhista", title: "Petição Inicial de Consignação em Pagamento" },
  { area: "Trabalhista", title: "Petição Inicial de Inquérito para Apuração de Falta Grave" },
  { area: "Trabalhista", title: "Petição Inicial de Mandado de Segurança Trabalhista" },
  { area: "Trabalhista", title: "Contestação Trabalhista" },
  { area: "Trabalhista", title: "Exceção de Incompetência Territorial" },
  { area: "Trabalhista", title: "Reconvenção Trabalhista" },
  { area: "Trabalhista", title: "Réplica Trabalhista" },
  { area: "Trabalhista", title: "Defesa Administrativa contra Auto de Infração do Ministério do Trabalho e Emprego (MTE)" },
  { area: "Trabalhista", title: "Embargos à Execução Trabalhista" },
  { area: "Trabalhista", title: "Exceção de Pré-Executividade Trabalhista" },
  { area: "Trabalhista", title: "Embargos de Terceiro Trabalhista" },

  { area: "Tributário", title: "Petição Inicial de Mandado de Segurança Preventivo" },
  { area: "Tributário", title: "Petição Inicial de Mandado de Segurança Repressivo" },
  { area: "Tributário", title: "Petição Inicial Declaratória de Inexistência de Relação Jurídica Tributária" },
  { area: "Tributário", title: "Petição Inicial Anulatória de Débito Fiscal" },
  { area: "Tributário", title: "Petição Inicial de Repetição de Indébito Tributário" },
  { area: "Tributário", title: "Petição Inicial de Consignação em Pagamento Tributário" },
  { area: "Tributário", title: "Petição Inicial de Ação Cautelar de Caução Antecipada" },
  { area: "Tributário", title: "Impugnação a Auto de Infração e Imposição de Multa (AIIM)" },
  { area: "Tributário", title: "Recurso Voluntário" },
  { area: "Tributário", title: "Manifestação de Inconformidade (Contra não homologação de compensação)" },
  { area: "Tributário", title: "Requerimento de Restituição, Ressarcimento ou Reembolso" },
  { area: "Tributário", title: "Petição de Consulta Tributária" },
  { area: "Tributário", title: "Defesa em Processo Administrativo de Cassação de Inscrição Estadual" },
  { area: "Tributário", title: "Pedido de Revisão de Débito Inscrito em Dívida Ativa" },
  { area: "Tributário", title: "Exceção de Pré-Executividade Tributária" },
  { area: "Tributário", title: "Embargos à Execução Fiscal" },
  { area: "Tributário", title: "Pedido de Reconhecimento de Prescrição Intercorrente (Art. 40 da LEF)" },
  { area: "Tributário", title: "Pedido de Desbloqueio de Contas Bancárias" },
  { area: "Tributário", title: "Petição para Expedição de Certidão de Regularidade Fiscal (CPEN/CND) mediante penhora" },

  { area: "Recursos", title: "Recurso de Apelação" },
  { area: "Recursos", title: "Contrarrazões de Apelação" },
  { area: "Recursos", title: "Agravo de Instrumento" },
  { area: "Recursos", title: "Contraminuta ao Agravo de Instrumento" },
  { area: "Recursos", title: "Agravo Interno (Agravo Regimental)" },
  { area: "Recursos", title: "Embargos de Declaração" },
  { area: "Recursos", title: "Recurso Ordinário Constitucional" },
  { area: "Recursos", title: "Recurso Especial" },
  { area: "Recursos", title: "Contrarrazões ao Recurso Especial" },
  { area: "Recursos", title: "Recurso Extraordinário" },
  { area: "Recursos", title: "Contrarrazões ao Recurso Extraordinário" },
  { area: "Recursos", title: "Agravo em Recurso Especial ou Extraordinário" },
  { area: "Recursos", title: "Embargos de Divergência" },
  { area: "Recursos", title: "Recurso Inominado" },
  { area: "Recursos", title: "Contrarrazões ao Recurso Inominado" },
  { area: "Recursos", title: "Incidente de Uniformização de Interpretação de Lei (PUIL - Turmas Regionais e TNU)" },
  { area: "Recursos", title: "Recurso Ordinário Trabalhista (RO)" },
  { area: "Recursos", title: "Contrarrazões ao Recurso Ordinário" },
  { area: "Recursos", title: "Embargos de Declaração Trabalhistas" },
  { area: "Recursos", title: "Agravo de Petição" },
  { area: "Recursos", title: "Contraminuta ao Agravo de Petição" },
  { area: "Recursos", title: "Recurso de Revista" },
  { area: "Recursos", title: "Contrarrazões ao Recurso de Revista" },
  { area: "Recursos", title: "Agravo de Instrumento em Recurso de Revista" },
  { area: "Recursos", title: "Agravo de Instrumento em Recurso Ordinário" },
  { area: "Recursos", title: "Agravo de Instrumento em Agravo de Petição" },
  { area: "Recursos", title: "Embargos ao TST (Para a SDI - Seção de Dissídios Individuais)" },
  { area: "Recursos", title: "Agravo Interno / Regimental Trabalhista" },
  { area: "Recursos", title: "Recurso em Sentido Estrito (RESE)" },
  { area: "Recursos", title: "Contrarrazões ao Recurso em Sentido Estrito" },
  { area: "Recursos", title: "Recurso de Apelação Criminal" },
  { area: "Recursos", title: "Razões de Apelação Criminal Isolada" },
  { area: "Recursos", title: "Contrarrazões de Apelação Criminal" },
  { area: "Recursos", title: "Embargos de Declaração Criminais" },
  { area: "Recursos", title: "Embargos Infringentes e de Nulidade" },
  { area: "Recursos", title: "Agravo em Execução Penal" },
  { area: "Recursos", title: "Contraminuta ao Agravo em Execução Penal" },
  { area: "Recursos", title: "Carta Testemunhável" },
  { area: "Recursos", title: "Recurso Ordinário Constitucional em Habeas Corpus (RHC)" },
  { area: "Recursos", title: "Recurso Ordinário à Junta de Recursos (JRPS)" },
  { area: "Recursos", title: "Recurso Especial à Câmara de Julgamento (CAJ)" },
  { area: "Recursos", title: "Embargos de Declaração Administrativos (INSS/CRPS)" },
  { area: "Recursos", title: "Incidente de Resolução de Litígios Administrativos Previdenciários" },
  { area: "Recursos", title: "Recurso Administrativo / Recurso Voluntário" },
  { area: "Recursos", title: "Recurso Hierárquico" },
  { area: "Recursos", title: "Pedido de Reconsideração Administrativa" },
  { area: "Recursos", title: "Embargos de Declaração Administrativos" },
  { area: "Recursos", title: "Recurso Especial Administrativo" },
  ];
}

function buildCatalogPrompts(seeds: CatalogSeed[]): assistantPrompt[] {
  return seeds.map((seed) => {
    const id = toPromptId(seed.area, seed.title);
    return {
      id,
      title: seed.title,
      area: seed.area,
      description: `Modelo de ${seed.title.toLowerCase()} em ${seed.area.toLowerCase()}.`,
      prompt: `Com base APENAS nos documentos do notebook, redija ${seed.title.toUpperCase()}.

Regras:
- Use somente fatos e provas documentadas
- Não invente dados, precedentes, prazos ou documentos
- Onde faltar elemento essencial, marque [VERIFICAR]
- Estruture a peça em tópicos objetivos e pedidos finais claros.`,
    };
  });
}

function toPromptId(area: string, title: string): string {
  const normalized = `${area}-${title}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 96);
}

export function fillPromptTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v || "[preencher]");
  }
  return out;
}
