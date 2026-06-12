(function () {
  const CONCURRENCY = 5
  const FETCH_TIMEOUT_MS = 12000
  const HEARTBEAT_MS = 2000

  let crawlAbort = false
  let crawlBusy = false
  let crawlState = null

  const ESaj = {
    isSearchForm() {
      return Boolean(document.querySelector("#formConsulta, form[name='formConsulta']"))
    },

    isProcessPage() {
      return (
        /show\.do|processo\.codigo/i.test(location.href) ||
        Boolean(document.querySelector("#tableTodasPartes, #partesProcesso, .unj-base-altura-auto"))
      )
    },

    isResultsList() {
      return (
        /search\.do/i.test(location.href) &&
        Boolean(document.querySelector("#listagemDeProcessos, .fundocinza1, table, a[href*='show.do']"))
      )
    },

    collectProcessLinks() {
      return EsajParse.collectProcessLinksFromDocument(document, location.href)
    },

    parseCurrentProcess() {
      return EsajParse.analyzeProcessDocument(document, location.href)
    },

    parseResultsList() {
      return this.collectProcessLinks()
    },
  }

  function extensionAlive() {
    try {
      return Boolean(chrome.runtime?.id)
    } catch {
      return false
    }
  }

  function broadcastProgress(payload) {
    if (!extensionAlive()) {
      broadcastProgress.failed = true
      return
    }
    chrome.runtime.sendMessage({ type: "ESAJ_CRAWL_PROGRESS", ...payload }).catch(() => {
      broadcastProgress.failed = true
    })
    chrome.runtime.sendMessage({ type: "KEEPALIVE" }).catch(() => {})
  }
  broadcastProgress.failed = false

  async function fetchProcessAnalysis(url) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        credentials: "include",
        redirect: "follow",
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, "text/html")
      return EsajParse.analyzeProcessDocument(doc, url)
    } catch (err) {
      if (err.name === "AbortError") throw new Error("timeout (página lenta)")
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  function saveMatchLead(analysis) {
    if (!extensionAlive()) return
    chrome.runtime.sendMessage({
      type: "SAVE_LEAD",
      lead: {
        source: "esaj",
        numero: analysis.numero,
        url: analysis.url,
        tipo: "execucao",
        titulo: analysis.executadoNome || analysis.numero,
        execucao: true,
        bancoExequente: true,
        executadoSemAdv: true,
        classe: analysis.classe,
        assunto: analysis.assunto,
      },
    }).catch(() => {
      broadcastProgress.failed = true
    })
  }

  function classifyResult(analysis, link) {
    const item = { ...analysis, listaTexto: link.texto }
    if (analysis.match) return { kind: "match", item }
    if (analysis.execucao && analysis.bancoExequente) {
      return {
        kind: "skip",
        item: {
          ...item,
          motivo:
            analysis.executadoSemAdv === false
              ? "Todos os executados têm advogado"
              : "Executado com advogado ou não identificado",
        },
      }
    }
    return {
      kind: "skip",
      item: { ...item, motivo: analysis.motivoRejeicao || "Não é execução com banco exequente" },
    }
  }

  async function processLink(link, state) {
    const analysis = await fetchProcessAnalysis(link.url)
    const { kind, item } = classifyResult(analysis, link)

    if (kind === "match") {
      state.matches.push(item)
      saveMatchLead(analysis)
      broadcastProgress({
        phase: "match",
        item,
        matches: state.matches.length,
        total: state.total,
      })
    } else {
      state.skipped.push(item)
    }
  }

  async function runCrawlExecutions() {
    if (!extensionAlive()) {
      return {
        ok: false,
        error: "Extensão foi recarregada — pressione F5 na página do e-SAJ e tente de novo.",
      }
    }

    if (crawlBusy) {
      return { ok: false, error: "Já existe uma varredura em andamento nesta aba." }
    }

    if (!ESaj.isResultsList()) {
      return {
        ok: false,
        error: "Abra a lista de resultados do e-SAJ (após buscar o banco manualmente).",
      }
    }

    const links = ESaj.collectProcessLinks()
    if (!links.length) {
      return { ok: false, error: "Nenhum link de processo encontrado nesta página." }
    }

    crawlBusy = true
    crawlAbort = false
    broadcastProgress.failed = false

    const state = {
      listUrl: location.href,
      total: links.length,
      completed: 0,
      matches: [],
      skipped: [],
      errors: [],
      running: true,
      startedAt: Date.now(),
    }
    crawlState = state

    broadcastProgress({
      phase: "start",
      total: links.length,
      concurrency: CONCURRENCY,
      state,
    })

    let nextIndex = 0
    const startedAt = Date.now()

    const heartbeatId = setInterval(() => {
      if (!state.running) return
      const elapsed = Math.round((Date.now() - startedAt) / 1000)
      const rate = state.completed > 0 ? state.completed / elapsed : 0
      const remaining = rate > 0 ? Math.round((links.length - state.completed) / rate) : null
      broadcastProgress({
        phase: "heartbeat",
        current: state.completed,
        total: links.length,
        matches: state.matches.length,
        errors: state.errors.length,
        elapsed,
        etaSec: remaining,
      })
    }, HEARTBEAT_MS)

    async function worker() {
      while (true) {
        if (crawlAbort || broadcastProgress.failed) return

        const i = nextIndex++
        if (i >= links.length) return

        const link = links[i]
        try {
          await processLink(link, state)
        } catch (err) {
          state.errors.push({ url: link.url, error: String(err.message || err) })
        }

        state.completed++
        broadcastProgress({
          phase: "tick",
          current: state.completed,
          total: links.length,
          matches: state.matches.length,
          errors: state.errors.length,
          url: link.url,
          state,
        })
      }
    }

    try {
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

      if (crawlAbort) state.stopped = true
      state.running = false
      state.finishedAt = new Date().toISOString()

      const elapsedSec = Math.round((Date.now() - startedAt) / 1000)
      const result = {
        ok: true,
        message: `${state.matches.length} oportunidade(s) em ${links.length} processo(s) — ${elapsedSec}s.`,
        matches: state.matches,
        total: links.length,
        errors: state.errors,
        elapsedSec,
      }

      if (broadcastProgress.failed) {
        result.message += " Recarregue F5 se o painel parou de atualizar."
      }

      broadcastProgress({
        phase: "done",
        total: links.length,
        matches: state.matches,
        skippedCount: state.skipped.length,
        errorCount: state.errors.length,
        elapsedSec,
        state,
        message: result.message,
      })

      return result
    } finally {
      clearInterval(heartbeatId)
      crawlBusy = false
    }
  }

  async function stopCrawl() {
    crawlAbort = true
    if (crawlState) {
      crawlState.running = false
      crawlState.stopped = true
      broadcastProgress({ phase: "stopped", state: crawlState })
    }
    return { ok: true, message: "Varredura interrompida." }
  }

  function scanPage() {
    let payload
    if (ESaj.isProcessPage()) {
      payload = { mode: "processo", ...ESaj.parseCurrentProcess() }
    } else if (ESaj.isResultsList()) {
      const links = ESaj.parseResultsList()
      payload = { mode: "lista", items: links, linkCount: links.length }
    } else {
      payload = { mode: "form", onSearchForm: ESaj.isSearchForm() }
    }
    if (extensionAlive()) {
      chrome.runtime.sendMessage({ type: "PAGE_SCAN", site: "esaj", url: location.href, ...payload }).catch(() => {})
    }
    return { ok: true, ...payload }
  }

  function onPanelMessage(msg, _sender, sendResponse) {
    if (msg.type === "PING") {
      sendResponse({ ok: true, site: "esaj", busy: crawlBusy })
      return
    }
    if (msg.type !== "PANEL_ACTION") return false

    switch (msg.action) {
      case "scan":
        sendResponse(scanPage())
        return
      case "crawl_execucoes": {
        if (crawlBusy) {
          sendResponse({ ok: false, error: "Varredura já em andamento nesta aba." })
          return
        }
        if (!ESaj.isResultsList()) {
          sendResponse({
            ok: false,
            error: "Abra a lista de resultados do e-SAJ (após buscar o banco manualmente).",
          })
          return
        }
        const links = ESaj.collectProcessLinks()
        if (!links.length) {
          sendResponse({ ok: false, error: "Nenhum link de processo encontrado nesta página." })
          return
        }
        sendResponse({
          ok: true,
          started: true,
          total: links.length,
          concurrency: CONCURRENCY,
          message: `Analisando ${links.length} processo(s) em paralelo (${CONCURRENCY} por vez)…`,
        })
        runCrawlExecutions().catch((e) => {
          broadcastProgress({ phase: "error", error: String(e.message || e) })
        })
        return
      }
      case "stop_crawl":
        stopCrawl().then(sendResponse)
        return true
      case "open_cpopg":
        location.href = "https://esaj.tjsp.jus.br/cpopg/open.do"
        sendResponse({ ok: true })
        return
      default:
        sendResponse({ ok: false, error: "Ação desconhecida." })
    }
    return false
  }

  if (!globalThis.__captacaoEsajListener) {
    globalThis.__captacaoEsajListener = true
    chrome.runtime.onMessage.addListener(onPanelMessage)
  }

  if (!globalThis.__captacaoEsajScanned) {
    globalThis.__captacaoEsajScanned = true
    setTimeout(scanPage, 1500)
  }
})()
