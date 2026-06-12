(function () {
  const JURIDICO_RE =
    /advocac|assessoria jur|consultoria jur|honor[aá]rios advoc|escrit[oó]rio de advoc|procuradoria|defensoria|contencioso|parecer jur|representa[cç][aã]o judicial|credenciamento.*advog|servi[cç]os advocat/i

  function fixLinks(root = document) {
    root.querySelectorAll('a[href*="/compras/"], a[href*="/app/compras/"]').forEach((a) => {
      const fixed = PncpUrl.normalizePncpPortalUrl(a.getAttribute("href") || a.href)
      if (fixed && fixed !== a.href) {
        a.href = fixed
        a.setAttribute("href", fixed)
      }
    })
  }

  function extractFromDom() {
    const items = []
    const seen = new Set()

    document.querySelectorAll('a[href*="/editais/"], a[href*="/compras/"]').forEach((a) => {
      const href = PncpUrl.normalizePncpPortalUrl(a.getAttribute("href") || a.href)
      if (!href || seen.has(href)) return
      const card = a.closest("tr, article, li, .card, [class*='result'], [class*='item']") || a.parentElement
      const text = (card?.innerText || a.innerText || "").slice(0, 2000)
      if (!JURIDICO_RE.test(text) && !JURIDICO_RE.test(a.innerText)) return
      seen.add(href)
      items.push({
        titulo: (a.innerText || text.split("\n")[0] || "Edital PNCP").trim().slice(0, 200),
        url: href,
        trecho: text.slice(0, 400),
        juridico: true,
      })
    })

    return items
  }

  function scanPage() {
    fixLinks()
    const items = extractFromDom()
    chrome.runtime.sendMessage({
      type: "PAGE_SCAN",
      site: "pncp",
      url: location.href,
      items,
      linksCorrigidos: document.querySelectorAll('a[href*="/editais/"]').length,
    })
    return { ok: true, count: items.length, items }
  }

  function onPanelMessage(msg, _sender, sendResponse) {
    if (msg.type === "PING") {
      sendResponse({ ok: true, site: "pncp" })
      return
    }
    if (msg.type === "PANEL_ACTION") {
      if (msg.action === "fix_links") {
        fixLinks()
        sendResponse({ ok: true, message: "Links PNCP corrigidos (/compras → /editais)." })
        return
      }
      if (msg.action === "scan") {
        sendResponse(scanPage())
        return
      }
      if (msg.action === "open_search") {
        const q = encodeURIComponent(msg.payload?.termo || "advocacia")
        location.href = `${PncpUrl.PNCP_APP}/editais?q=${q}`
        sendResponse({ ok: true })
        return
      }
    }
    return false
  }

  if (!globalThis.__captacaoPncpListener) {
    globalThis.__captacaoPncpListener = true
    chrome.runtime.onMessage.addListener(onPanelMessage)
  }

  if (!globalThis.__captacaoPncpObserved) {
    globalThis.__captacaoPncpObserved = true
    const observer = new MutationObserver(() => fixLinks())
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true })
      fixLinks()
      setTimeout(scanPage, 1200)
    }
  }
})()
