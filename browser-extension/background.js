chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

const CONTEXT = { tabId: null, site: "unknown", url: "" }

const SITE_SCRIPTS = {
  pncp: ["lib/pncp-url.js", "content/pncp.js"],
  esaj: ["lib/banks.js", "lib/esaj-parse.js", "content/esaj.js"],
  eproc: ["lib/banks.js", "content/eproc.js"],
}

const LISTENER_FLAGS = {
  pncp: "__captacaoPncpListener",
  esaj: "__captacaoEsajListener",
  eproc: "__captacaoEprocListener",
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url) return
  const site = detectSite(tab.url)
  if (site === "unknown") return
  CONTEXT.tabId = tabId
  CONTEXT.site = site
  CONTEXT.url = tab.url
  chrome.sidePanel.setOptions({ tabId, path: "sidepanel/index.html", enabled: true }).catch(() => {})
})

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (!tab.url || detectSite(tab.url) === "unknown") return
    CONTEXT.tabId = tabId
    CONTEXT.site = detectSite(tab.url)
    CONTEXT.url = tab.url
  } catch {
    /* tab closed */
  }
})

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  return tab
}

async function resolveTargetTab() {
  const active = await activeTab()
  if (active?.id && active.url && detectSite(active.url) !== "unknown") return active

  if (CONTEXT.tabId) {
    try {
      const tab = await chrome.tabs.get(CONTEXT.tabId)
      if (tab.url && detectSite(tab.url) !== "unknown") return tab
    } catch {
      CONTEXT.tabId = null
    }
  }

  const tabs = await chrome.tabs.query({ currentWindow: true })
  return tabs.find((t) => t.url && detectSite(t.url) !== "unknown") || null
}

function friendlyError(err, site) {
  const raw = String(err?.message || err || "")
  if (/receiving end does not exist|could not establish connection/i.test(raw)) {
    const hints = {
      esaj: "Clique na aba do e-SAJ com a lista de resultados e tente de novo (ou recarregue a página com F5).",
      pncp: "Clique na aba do PNCP e tente de novo (ou recarregue a página com F5).",
      eproc: "Clique na aba do eProc e tente de novo (ou recarregue a página com F5).",
    }
    return hints[site] || "Abra uma aba do PNCP ou TJSP e tente de novo."
  }
  if (/cannot access|extension context invalidated/i.test(raw)) {
    return "Extensão foi recarregada — recarregue a página do site (F5) e tente novamente."
  }
  return raw || "Erro ao comunicar com a aba."
}

async function pingContentScript(tabId, retries = 4) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, { type: "PING" })
      if (res?.ok) return res
    } catch {
      /* retry */
    }
    if (i < retries) await new Promise((r) => setTimeout(r, 150 * (i + 1)))
  }
  return null
}

async function resetScriptListeners(tabId, site) {
  const flag = LISTENER_FLAGS[site]
  if (!flag) return
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (name) => {
        delete globalThis[name]
      },
      args: [flag],
    })
  } catch {
    /* ignore */
  }
}

async function injectContentScripts(tabId, site) {
  const files = SITE_SCRIPTS[site]
  if (!files) return false

  await resetScriptListeners(tabId, site)
  await chrome.scripting.executeScript({ target: { tabId }, files })
  return true
}

async function ensureContentScripts(tabId, site) {
  const files = SITE_SCRIPTS[site]
  if (!files) return false

  const firstPing = await pingContentScript(tabId, 1)
  if (firstPing?.ok) return true

  try {
    await injectContentScripts(tabId, site)
  } catch (err) {
    throw new Error(friendlyError(err, site))
  }

  const secondPing = await pingContentScript(tabId, 5)
  return Boolean(secondPing?.ok)
}

async function sendPanelAction(tabId, site, action, payload) {
  const ready = await ensureContentScripts(tabId, site)
  if (!ready) {
    throw new Error(
      site === "esaj"
        ? "Não foi possível conectar ao e-SAJ. Abra a lista de resultados, recarregue (F5) e clique em Varrer execuções."
        : `Não foi possível conectar à aba (${site}). Recarregue a página (F5) e tente novamente.`,
    )
  }

  try {
    return await chrome.tabs.sendMessage(tabId, { type: "PANEL_ACTION", action, payload })
  } catch (err) {
    try {
      await injectContentScripts(tabId, site)
      return await chrome.tabs.sendMessage(tabId, { type: "PANEL_ACTION", action, payload })
    } catch (retryErr) {
      throw new Error(friendlyError(retryErr, site))
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "KEEPALIVE") {
    sendResponse({ ok: true })
    return
  }

  if (msg.type === "GET_CONTEXT") {
    resolveTargetTab()
      .then((tab) => {
        const site = tab?.url ? detectSite(tab.url) : CONTEXT.site
        sendResponse({
          site,
          url: tab?.url || CONTEXT.url,
          tabId: tab?.id ?? CONTEXT.tabId,
        })
      })
      .catch(() => sendResponse({ site: CONTEXT.site, url: CONTEXT.url, tabId: CONTEXT.tabId }))
    return true
  }

  if (msg.type === "RUN_ACTION") {
    resolveTargetTab()
      .then(async (tab) => {
        if (!tab?.id || !tab.url) {
          sendResponse({
            ok: false,
            error: "Nenhuma aba do PNCP ou TJSP encontrada. Abra o site e clique nele antes de usar o painel.",
          })
          return
        }

        const site = detectSite(tab.url)
        if (site === "unknown") {
          sendResponse({
            ok: false,
            error: "A aba ativa não é PNCP nem TJSP. Clique na aba correta (lista de processos no e-SAJ, etc.).",
          })
          return
        }

        try {
          const result = await sendPanelAction(tab.id, site, msg.action, msg.payload)
          sendResponse(result ?? { ok: true })
        } catch (err) {
          sendResponse({ ok: false, error: String(err.message || err) })
        }
      })
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }))
    return true
  }

  if (msg.type === "SAVE_LEAD") {
    saveLead(msg.lead).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }

  if (msg.type === "LIST_LEADS") {
    listLeads().then((leads) => sendResponse({ ok: true, leads })).catch((e) => sendResponse({ ok: false, error: String(e) }))
    return true
  }

  if (msg.type === "PAGE_SCAN") {
    chrome.runtime.sendMessage({ type: "PANEL_SCAN", ...msg, tabId: sender.tab?.id }).catch(() => {})
    sendResponse({ ok: true })
    return
  }

  if (msg.type === "ESAJ_CRAWL_PROGRESS") {
    if (msg.state) {
      chrome.storage.session.set({ esaj_crawl_state: msg.state }).catch(() => {})
    }
    chrome.runtime.sendMessage({ type: "PANEL_ESAJ_CRAWL", ...msg }).catch(() => {})
    sendResponse({ ok: true })
    return
  }

  if (msg.type === "GET_CRAWL_STATE") {
    chrome.storage.session.get("esaj_crawl_state").then((data) => {
      sendResponse({ ok: true, state: data.esaj_crawl_state || null })
    })
    return true
  }
})

function detectSite(url) {
  if (/pncp\.gov\.br/i.test(url)) return "pncp"
  if (/esaj\.tjsp\.jus\.br/i.test(url)) return "esaj"
  if (/eproc-consulta\.tjsp\.jus\.br|eproc1g\.tjsp\.jus\.br/i.test(url)) return "eproc"
  return "unknown"
}

async function saveLead(lead) {
  const { captacao_leads = [] } = await chrome.storage.local.get("captacao_leads")
  const id = lead.id || `${lead.source}-${lead.numero || lead.titulo || Date.now()}`
  const next = captacao_leads.filter((l) => l.id !== id)
  next.unshift({ ...lead, id, savedAt: new Date().toISOString() })
  await chrome.storage.local.set({ captacao_leads: next.slice(0, 500) })
}

async function listLeads() {
  const { captacao_leads = [] } = await chrome.storage.local.get("captacao_leads")
  return captacao_leads
}
