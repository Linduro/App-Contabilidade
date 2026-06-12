(function () {
  /** eProc exige Turnstile — só auxiliamos preenchimento, não submetemos. */

  function fillProcesso(numero) {
    const input = document.querySelector("#txtNumProcesso, [name='num_processo'], input[id*='Processo']")
    if (!input) return { ok: false, error: "Campo de processo não encontrado (resolva o captcha antes)." }
    input.value = numero
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return { ok: true, message: "Número preenchido. Resolva o captcha e clique em Consultar." }
  }

  function scanPage() {
    const captcha = Boolean(document.querySelector(".cf-turnstile, #divInfraCaptcha iframe"))
    const processo = document.querySelector("#txtNumProcesso")?.value || ""
    const resultArea = document.querySelector("#divInfraAreaDados, #divInfraAreaTabela")
    const payload = {
      site: "eproc",
      url: location.href,
      captchaPresente: captcha,
      processo,
      temResultado: Boolean(resultArea?.innerText?.trim()),
      texto: (resultArea?.innerText || "").slice(0, 1500),
    }
    chrome.runtime.sendMessage({ type: "PAGE_SCAN", ...payload })
    return { ok: true, ...payload }
  }

  function onPanelMessage(msg, _sender, sendResponse) {
    if (msg.type === "PING") {
      sendResponse({ ok: true, site: "eproc" })
      return
    }
    if (msg.type !== "PANEL_ACTION") return false
    if (msg.action === "scan") {
      sendResponse(scanPage())
      return
    }
    if (msg.action === "fill_processo") {
      sendResponse(fillProcesso(msg.payload?.numero || ""))
      return
    }
    if (msg.action === "open_consulta") {
      location.href =
        "https://eproc-consulta.tjsp.jus.br/consulta_1g/externo_controlador.php?acao=tjsp@consulta_unificada_publica/consultar"
      sendResponse({ ok: true })
      return
    }
    sendResponse({ ok: false, error: "Ação não suportada no eProc." })
    return false
  }

  if (!globalThis.__captacaoEprocListener) {
    globalThis.__captacaoEprocListener = true
    chrome.runtime.onMessage.addListener(onPanelMessage)
  }

  if (!globalThis.__captacaoEprocScanned) {
    globalThis.__captacaoEprocScanned = true
    setTimeout(scanPage, 1500)
  }
})()
