/** Parser e critérios — execução bancária com executado sem advogado (e-SAJ TJSP) */

const EXECUCAO_RE =
  /execu[cç][aã]o|cumprimento de senten[cç]a|execu[cç][oõ]es de t[ií]tulo|t[ií]tulo extrajudicial|monit[oó]ria|contratos banc[aá]rios|contrato banc[aá]rio/i
const EXECUCAO_CLASSE_RE = /\b(1116|10980|877|40|156|157|158|159|12154)\b/

const POLO_ATIVO_RE =
  /exeq|exequ|autor|reqte|requerent|impetr|credor|embargad[oa].*devedor|\bativo\b/i
const POLO_PASSIVO_RE =
  /exect|executad|r[eé]u|reqd|requerid|passiv|devedor|embargante|\binvtad/i

const ADV_LABEL_RE = /advogad|adv\.\s*dativa|defensor|curador|procurador/i

function isPoloAtivo(tipo) {
  return POLO_ATIVO_RE.test(String(tipo || ""))
}

function isPoloPassivo(tipo) {
  return POLO_PASSIVO_RE.test(String(tipo || ""))
}

function isAdvogadoRow(tipo) {
  return /^advogad|^adv\.\s*$/i.test(String(tipo || "").trim())
}

function extractNomeAdvogados(parteEl) {
  const advogados = []

  parteEl.querySelectorAll("span.mensagemExibindo").forEach((span) => {
    if (!ADV_LABEL_RE.test(span.textContent || "")) return

    const parts = []
    let node = span.nextSibling
    while (node) {
      if (node.nodeType === 3) parts.push(node.textContent)
      else if (node.nodeType === 1) {
        if (node.tagName === "BR") break
        if (node.classList?.contains("mensagemExibindo")) break
        parts.push(node.textContent)
      }
      node = node.nextSibling
    }

    const adv = parts.join("").replace(/\s+/g, " ").trim()
    if (adv) advogados.push(adv)
  })

  let nome = ""
  const nomeEl = parteEl.querySelector(".nomeParte, span.nomeParte")
  if (nomeEl) {
    nome = nomeEl.textContent.replace(/\s+/g, " ").trim()
  } else {
    const full = parteEl.innerText.replace(/\s+/g, " ").trim()
    const split = full.split(/\s*(?:Advogad[oa]|Adv\.\s*Dativa|Defensor|Curador|Procurador)\s*:/i)
    nome = (split[0] || "").trim()
  }

  return { nome, advogados: advogados.join(" | ") }
}

function parsePartesRow(tr) {
  const tipoEl = tr.querySelector(".tipoDeParticipacao")
  const parteEl = tr.querySelector(".nomeParteEAdvogado")
  if (tipoEl && parteEl) {
    const tipo = tipoEl.textContent.replace(/\s+/g, " ").trim()
    if (isAdvogadoRow(tipo)) return null
    const { nome, advogados } = extractNomeAdvogados(parteEl)
    if (!nome || nome.length < 2) return null
    return { nome, tipo, advogados, texto: `${tipo} | ${nome}${advogados ? " | " + advogados : ""}` }
  }

  const cells = [...tr.querySelectorAll("td")].map((c) => c.innerText.replace(/\s+/g, " ").trim())
  if (cells.length < 2) return null

  let tipo
  let nomeCell

  if (isPoloAtivo(cells[0]) || isPoloPassivo(cells[0]) || isAdvogadoRow(cells[0])) {
    tipo = cells[0]
    nomeCell = cells[1]
  } else if (isPoloAtivo(cells[1]) || isPoloPassivo(cells[1])) {
    tipo = cells[1]
    nomeCell = cells[0]
  } else {
    return null
  }

  if (isAdvogadoRow(tipo)) return null

  const split = String(nomeCell || "").split(/\s*(?:Advogad[oa]|Adv\.\s*Dativa|Defensor|Curador|Procurador)\s*:/i)
  const nome = (split[0] || "").trim()
  const advogados = split.slice(1).join(" | ").trim()
  if (!nome || nome.length < 2 || /parte|nome/i.test(nome)) return null

  return { nome, tipo, advogados, texto: `${tipo} | ${nomeCell}` }
}

function parsePartesFromDocument(doc) {
  const partes = []
  const seen = new Set()

  const tables = [
    doc.querySelector("#tableTodasPartes"),
    doc.querySelector("#tablePartesPrincipais"),
    doc.querySelector("#partesProcesso"),
  ].filter(Boolean)

  for (const table of tables) {
    table.querySelectorAll("tr").forEach((tr) => {
      const parte = parsePartesRow(tr)
      if (!parte) return
      const key = `${parte.tipo}|${parte.nome}|${parte.advogados}`
      if (seen.has(key)) return
      seen.add(key)
      partes.push(parte)
    })
    if (partes.length) break
  }

  if (!partes.length) {
    doc.querySelectorAll("tr").forEach((tr) => {
      const parte = parsePartesRow(tr)
      if (!parte) return
      const key = `${parte.tipo}|${parte.nome}|${parte.advogados}`
      if (seen.has(key)) return
      seen.add(key)
      partes.push(parte)
    })
  }

  return partes
}

function extractMetaFromDocument(doc) {
  const text = doc.body?.innerText || ""
  const numero =
    doc.querySelector("#numeroProcesso, .unj-larger")?.innerText?.trim() ||
    (text.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/) || [])[0] ||
    ""

  const classe =
    doc.querySelector("#classeProcesso")?.innerText?.trim() ||
    (text.match(/Classe[\s.:]+([^\n]+)/i) || [])[1]?.trim() ||
    null

  const assunto =
    doc.querySelector("#assuntoProcesso")?.innerText?.trim() ||
    (text.match(/Assunto[\s.:]+([^\n]+)/i) || [])[1]?.trim() ||
    null

  return { numero, classe, assunto, texto: text.slice(0, 8000) }
}

function isExecucao(meta) {
  const blob = `${meta.classe || ""} ${meta.assunto || ""} ${meta.texto || ""}`
  return EXECUCAO_RE.test(blob) || EXECUCAO_CLASSE_RE.test(blob)
}

function parteTemAdvogado(advogados) {
  const t = String(advogados || "").trim()
  return t.length > 0 && !/^[-–—\s]+$/.test(t)
}

function analyzePartes(partes) {
  const ativos = partes.filter((p) => isPoloAtivo(p.tipo))
  const passivos = partes.filter((p) => isPoloPassivo(p.tipo))

  const banks = globalThis.CaptacaoBanks
  const looksBank = (nome) => (banks ? banks.looksLikeBank(nome) : /banco|financeira|bradesco|itau|santander|caixa/i.test(nome || ""))

  const bancoExequente = partes.some(
    (p) => isPoloAtivo(p.tipo) && looksBank(p.nome),
  )

  let executadoSemAdv = false
  let executadoNome = null
  const executadosSemAdv = []

  for (const p of passivos) {
    if (looksBank(p.nome)) continue
    if (parteTemAdvogado(p.advogados)) continue
    executadoSemAdv = true
    executadoNome = p.nome
    executadosSemAdv.push(p.nome)
  }

  return {
    bancoExequente,
    executadoSemAdv,
    executadoNome,
    executadosSemAdv,
    ativos,
    passivos,
  }
}

function analyzeProcessDocument(doc, url) {
  const meta = extractMetaFromDocument(doc)
  const partes = parsePartesFromDocument(doc)
  const analise = analyzePartes(partes)
  const execucao = isExecucao(meta)

  const match = execucao && analise.bancoExequente && analise.executadoSemAdv

  let motivoRejeicao = null
  if (!match) {
    if (!execucao) motivoRejeicao = "não é execução"
    else if (!analise.bancoExequente) motivoRejeicao = "exequente não é banco"
    else if (!analise.executadoSemAdv) motivoRejeicao = "todos os executados têm advogado"
    else motivoRejeicao = "critérios não atendidos"
  }

  return {
    numero: meta.numero,
    url: url || "",
    classe: meta.classe,
    assunto: meta.assunto,
    execucao,
    bancoExequente: analise.bancoExequente,
    executadoSemAdv: analise.executadoSemAdv,
    executadoNome: analise.executadoNome,
    executadosSemAdv: analise.executadosSemAdv,
    match,
    motivoRejeicao,
    partes: partes.slice(0, 30).map((p) => p.texto),
    partesCount: partes.length,
  }
}

function collectProcessLinksFromDocument(doc, baseUrl) {
  const links = []
  const seen = new Set()

  doc.querySelectorAll('a[href*="show.do"], a[href*="processo.codigo"]').forEach((a) => {
    try {
      const href = new URL(a.getAttribute("href") || a.href, baseUrl).href
      if (seen.has(href)) return
      const rowText = (a.closest("tr")?.innerText || a.innerText || "").replace(/\s+/g, " ").trim()
      if (!/\d{7}-\d{2}\.\d{4}/.test(rowText) && !/processo\.codigo/i.test(href)) return
      seen.add(href)
      links.push({
        url: href,
        texto: rowText.slice(0, 250) || href,
      })
    } catch {
      /* ignore bad urls */
    }
  })

  return links
}

if (typeof globalThis !== "undefined") {
  globalThis.EsajParse = {
    analyzeProcessDocument,
    collectProcessLinksFromDocument,
    parsePartesFromDocument,
    extractMetaFromDocument,
    extractNomeAdvogados,
    isExecucao,
    analyzePartes,
    isPoloAtivo,
    isPoloPassivo,
  }
}
