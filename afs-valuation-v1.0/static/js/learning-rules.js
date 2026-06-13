// ============================================================
// AFS — Regras de aprendizado (DSL estilo Python, injetadas na IA)
// Não executa Python real — converte regras em instruções para o Gemini
// ============================================================

const AFS_DEFAULT_LEARNING_RULES = `# Regras de avaliação AFS — editável (DSL)
# Linhas com # são comentários. Blocos RULE definem orientações para a IA.

RULE prioridade_mercado_br:
    preferir anuncios brasileiros usados e novos
    se somente internacional multiplicar valor por 1.3
    citar links comparativos no raciocinio

RULE identificacao_visual:
    usar foto como Google Lens: identificar marca modelo categoria
    sugerir 2 a 5 comparaveis com faixa de preco antes da avaliacao final

RULE mobiliario:
    quando categoria contem mobiliario
    metodologia Comparativo Direto
    valor_usado baseado em moveis usados similares

RULE feedback_usuario:
    incorporar correcoes passadas de bens similares
    ajustar valor quando usuario indicou valor_correto
`;

function afsParseLearningRules(text) {
    const rules = [];
    let current = null;
    for (const line of String(text || '').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const ruleMatch = trimmed.match(/^RULE\s+([\w-]+)\s*:?\s*$/i);
        if (ruleMatch) {
            if (current) rules.push(current);
            current = { id: ruleMatch[1], lines: [] };
            continue;
        }
        if (current) current.lines.push(trimmed);
    }
    if (current) rules.push(current);
    return rules;
}

function afsRulesToPromptText(text) {
    const rules = afsParseLearningRules(text);
    if (!rules.length) return '';
    const blocks = rules.map(r => `- [${r.id}] ${r.lines.join(' | ')}`);
    return '\n\n=== REGRAS DE APRENDIZADO (configuradas pelo usuário — siga na avaliação) ===\n' + blocks.join('\n');
}

function afsFormatLearningsList(feedback, autoAprendizados, rulesText) {
    const lines = [];
    lines.push('# === APRENDIZADOS AFS ===');
    lines.push('# Gerado em: ' + new Date().toISOString());
    lines.push('');
    lines.push('# --- Regras ativas (DSL) ---');
    lines.push(rulesText || AFS_DEFAULT_LEARNING_RULES);
    lines.push('');
    lines.push('# --- Feedback manual ---');
    (feedback || []).slice(-50).forEach((f, i) => {
        lines.push(`# feedback_${i + 1}: eval=${f.evaluation_id} valor=${f.corrected_value} comentario=${JSON.stringify(f.user_comment || '')}`);
    });
    lines.push('');
    lines.push('# --- Auto-aprendizado ---');
    (autoAprendizados || []).slice(-50).forEach((a, i) => {
        lines.push(`# aprendizado_${i + 1}: ${a.descricao_bem} | valor_correto=${a.valor_correto} | ${a.feedback_usuario}`);
    });
    return lines.join('\n');
}

window.AFS_DEFAULT_LEARNING_RULES = AFS_DEFAULT_LEARNING_RULES;
window.afsParseLearningRules = afsParseLearningRules;
window.afsRulesToPromptText = afsRulesToPromptText;
window.afsFormatLearningsList = afsFormatLearningsList;
