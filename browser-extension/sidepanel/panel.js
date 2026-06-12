const $ = (sel) => document.querySelector(sel)
const status = (msg) => {
  $("#status").textContent = msg
}

let crawlRunning = false
let esajMatchesLive = []
let crawlStartedAt = 0

function formatEta(sec) {
  if (sec == null || !Number.isFinite(sec)) return ""
  if (sec < 60) return `~${sec}s restantes`
  return `~${Math.ceil(sec / 60)} min restantes`
}

function crawlProgressText(msg) {
  const cur = msg.current || 0
  const total = msg.total || 0
  const matches = msg.matches ?? 0
  const errs = msg.errors ?? 0
  let line = `${cur}/${total} processos · ${matches} oportunidade(s)`
  if (errs) line += ` · ${errs} erro(s)`
  if (msg.elapsed != null) line += ` · ${msg.elapsed}s`
  if (msg.etaSec != null) line += ` · ${formatEta(msg.etaSec)}`
  return line
}

async function runAction(action, payload) {
  status("Executando…")
  let res
  try {
    res = await chrome.runtime.sendMessage({ type: "RUN_ACTION", action, payload })
  } catch (err) {
    const msg = String(err?.message || err)
    status(/receiving end does not exist/i.test(msg) ? "Recarregue a aba do site (F5) e tente de novo." : msg)
    return { ok: false, error: msg }
  }
  if (!res?.ok && res?.error) status(res.error)
  else if (res?.message) status(res.message)
  else status("Concluído")
  return res
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name))
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`))
}

function renderCards(container, items, renderItem) {
  if (!items?.length) {
    container.innerHTML = '<p class="empty">Nenhum item encontrado.</p>'
    return
  }
  container.innerHTML = items.map(renderItem).join("")
}

async function saveLead(lead) {
  await chrome.runtime.sendMessage({ type: "SAVE_LEAD", lead })
  status("Salvo localmente")
  loadSalvos()
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab))
  })
}

function bindPncp() {
  $("#btn-pncp-search").addEventListener("click", () =>
    runAction("open_search", { termo: $("#pncp-termo").value.trim() }),
  )
  $("#btn-pncp-fix").addEventListener("click", () => runAction("fix_links"))
  $("#btn-pncp-scan").addEventListener("click", async () => {
    const res = await runAction("scan")
    renderCards($("#pncp-results"), res?.items, (it) => `
      <article class="card">
        <h3>${escapeHtml(it.titulo)}</h3>
        <p>${escapeHtml(it.trecho || "")}</p>
        <div class="card-actions">
          <a href="${escapeHtml(it.url)}" target="_blank" rel="noopener">Abrir edital</a>
          <button type="button" data-save-pncp='${escapeAttr(JSON.stringify(it))}'>Salvar</button>
        </div>
      </article>`)
  })

  $("#pncp-results").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-save-pncp]")
    if (!btn) return
    const it = JSON.parse(btn.dataset.savePncp)
    saveLead({ source: "pncp", titulo: it.titulo, url: it.url, tipo: "licitacao" })
  })
}

function setCrawlUi(running, current, total, text) {
  crawlRunning = running
  $("#btn-esaj-crawl").disabled = running
  $("#btn-esaj-stop").classList.toggle("hidden", !running)
  const prog = $("#esaj-progress")
  prog.classList.toggle("hidden", !running && !text)
  prog.classList.toggle("running", running)
  if (total > 0) {
    const pct = Math.min(100, Math.round((current / total) * 100))
    $("#esaj-progress-fill").style.width = `${pct}%`
    $("#esaj-progress-text").textContent = text || `${current}/${total}`
  } else if (text) {
    $("#esaj-progress-text").textContent = text
  }
}

function renderEsajMatches(matches) {
  if (!matches?.length) {
    $("#esaj-results").innerHTML = '<p class="empty">Nenhuma oportunidade ainda.</p>'
    return
  }
  renderCards($("#esaj-results"), matches, (it) => `
    <article class="card">
      <span class="badge ok">Oportunidade</span>
      <h3>${escapeHtml(it.numero || "Processo")}</h3>
      <p>${escapeHtml(it.executadoNome || "Executado")}</p>
      <p class="muted">${escapeHtml(it.classe || "")} ${it.assunto ? "· " + escapeHtml(it.assunto) : ""}</p>
      <div class="card-actions">
        <a href="${escapeHtml(it.url)}" target="_blank" rel="noopener">Abrir processo</a>
      </div>
    </article>`)
}

function appendEsajMatch(item) {
  esajMatchesLive.push(item)
  renderEsajMatches(esajMatchesLive)
}

function bindEsaj() {
  $("#btn-esaj-crawl").addEventListener("click", async () => {
    if (crawlRunning) return
    esajMatchesLive = []
    crawlStartedAt = Date.now()
    setCrawlUi(true, 0, 1, "Iniciando varredura…")
    $("#esaj-results").innerHTML = '<p class="empty muted">Oportunidades aparecem aqui conforme forem encontradas…</p>'
    const res = await runAction("crawl_execucoes")
    if (!res?.ok) {
      setCrawlUi(false, 0, 0, res?.error || "Erro na varredura")
      return
    }
    if (res?.started) {
      status(res.message || "Varredura em andamento…")
      if (res.total) setCrawlUi(true, 0, res.total, `0/${res.total} processos`)
      return
    }
    setCrawlUi(false, res?.total || 0, res?.total || 0, res?.message || "")
    if (res?.matches?.length) {
      renderEsajMatches(res.matches)
      loadSalvos()
    } else if (res?.ok) {
      $("#esaj-results").innerHTML = '<p class="empty">Nenhuma execução com banco exequente e executado sem advogado nesta página.</p>'
    }
  })

  $("#btn-esaj-stop").addEventListener("click", async () => {
    await runAction("stop_crawl")
    setCrawlUi(false, 0, 0, "Varredura interrompida")
  })

  $("#btn-esaj-open").addEventListener("click", () => runAction("open_cpopg"))
}

function bindEproc() {
  $("#btn-eproc-fill").addEventListener("click", () =>
    runAction("fill_processo", { numero: $("#eproc-numero").value.trim() }),
  )
  $("#btn-eproc-open").addEventListener("click", () => runAction("open_consulta"))
  $("#btn-eproc-scan").addEventListener("click", async () => {
    const res = await runAction("scan")
    $("#eproc-results").innerHTML = `
      <article class="card">
        <p>Captcha: ${res?.captchaPresente ? "presente (resolva manualmente)" : "não detectado"}</p>
        <p>${escapeHtml(res?.texto?.slice(0, 500) || "Sem resultados visíveis.")}</p>
      </article>`
  })
}

async function loadSalvos() {
  const res = await chrome.runtime.sendMessage({ type: "LIST_LEADS" })
  const list = res?.leads || []
  const box = $("#salvos-list")
  if (!list.length) {
    box.innerHTML = '<p class="empty">Nenhum item salvo ainda.</p>'
    return
  }
  renderCards(box, list, (it) => `
    <article class="card">
      <span class="badge">${escapeHtml(it.source)}</span>
      <h3>${escapeHtml(it.titulo || it.numero || "Item")}</h3>
      <p>${escapeHtml(it.savedAt?.slice(0, 19) || "")}</p>
      ${it.url ? `<a href="${escapeHtml(it.url)}" target="_blank">Abrir</a>` : ""}
    </article>`)
}

function bindSalvos() {
  $("#btn-salvos-refresh").addEventListener("click", loadSalvos)
  $("#btn-salvos-clear").addEventListener("click", async () => {
    await chrome.storage.local.set({ captacao_leads: [] })
    loadSalvos()
    status("Lista limpa")
  })
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;")
}

async function detectContext() {
  let ctx
  try {
    ctx = await chrome.runtime.sendMessage({ type: "GET_CONTEXT" })
  } catch {
    ctx = { site: "unknown" }
  }
  const labels = { pncp: "PNCP — licitações", esaj: "TJSP e-SAJ", eproc: "TJSP eProc", unknown: "site não suportado" }
  $("#site-label").textContent = labels[ctx?.site] || labels.unknown
  if (ctx?.site === "unknown") {
    status("Abra o PNCP ou TJSP e clique na aba antes de usar o painel.")
  }
  if (ctx?.site && ctx.site !== "unknown") switchTab(ctx.site === "eproc" ? "eproc" : ctx.site)
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "PANEL_SCAN" && msg.site === "pncp" && msg.items?.length) {
    status(`Varredura: ${msg.site}`)
    renderCards($("#pncp-results"), msg.items, (it) => `
      <article class="card">
        <h3>${escapeHtml(it.titulo)}</h3>
        <a href="${escapeHtml(it.url)}" target="_blank">Abrir</a>
      </article>`)
    return
  }

  if (msg.type === "PANEL_ESAJ_CRAWL") {
    if (msg.phase === "start") {
      setCrawlUi(true, 0, msg.total || 1, `Iniciando… ${msg.total || "?"} processos (${msg.concurrency || 5} em paralelo)`)
      status("Varredura em andamento — não feche a aba do e-SAJ.")
      return
    }
    if (msg.phase === "match") {
      appendEsajMatch(msg.item)
      status(`+1 oportunidade — ${msg.matches ?? esajMatchesLive.length} no total`)
      return
    }
    if (msg.phase === "tick" || msg.phase === "heartbeat") {
      setCrawlUi(true, msg.current || 0, msg.total || 0, crawlProgressText(msg))
      return
    }
    if (msg.phase === "stopped") {
      setCrawlUi(false, msg.state?.completed || 0, msg.state?.total || 0, "Varredura interrompida")
      return
    }
    if (msg.phase === "error") {
      setCrawlUi(false, 0, 0, msg.error || "Erro na varredura")
      status(msg.error || "Erro na varredura")
      return
    }
    if (msg.phase === "done") {
      setCrawlUi(false, msg.total, msg.total, msg.message || `Concluído — ${msg.matches?.length || 0} oportunidade(s)`)
      status(msg.message || "Varredura concluída")
      if (msg.matches?.length) {
        esajMatchesLive = msg.matches
        renderEsajMatches(msg.matches)
      } else if (!esajMatchesLive.length) {
        $("#esaj-results").innerHTML = '<p class="empty">Nenhuma execução com banco exequente e executado sem advogado nesta página.</p>'
      }
      loadSalvos()
    }
  }
})

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") detectContext()
})

bindTabs()
bindPncp()
bindEsaj()
bindEproc()
bindSalvos()
detectContext()
loadSalvos()
