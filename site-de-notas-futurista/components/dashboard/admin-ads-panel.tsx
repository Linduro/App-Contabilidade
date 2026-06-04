"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Loader2,
  Megaphone,
  Plus,
  Save,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AD_ORIGIN_LABELS,
  AD_PLACEMENT_LABELS,
  createPlatformAd,
  defaultPlatformAdInput,
  deletePlatformAd,
  fetchAllPlatformAdsForAdmin,
  updatePlatformAd,
  type AdFormat,
  type AdOrigin,
  type AdPlacement,
  type PlatformAd,
  type PlatformAdInput,
} from "@/lib/platform-ads"

export function AdminAdsPanel() {
  const [ads, setAds] = useState<PlatformAd[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [feedback, setFeedback] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<PlatformAdInput>(defaultPlatformAdInput())

  const loadAds = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      setAds(await fetchAllPlatformAdsForAdmin())
    } catch {
      setError("Não foi possível carregar os anúncios. Publique as regras do Firestore (platformAds).")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAds()
  }, [loadAds])

  const startNew = () => {
    setEditingId(null)
    setForm({
      ...defaultPlatformAdInput(),
      sortOrder: ads.length,
    })
    setFeedback("")
    setError("")
  }

  const startEdit = (ad: PlatformAd) => {
    setEditingId(ad.id)
    const { id: _id, updatedAt: _u, ...rest } = ad
    setForm(rest)
    setFeedback("")
    setError("")
  }

  const patchForm = <K extends keyof PlatformAdInput>(key: K, value: PlatformAdInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Informe um título interno para identificar o anúncio.")
      return
    }

    if (form.format === "banner" && !form.headline.trim() && !form.imageUrl.trim()) {
      setError("Banner precisa de título ou imagem.")
      return
    }

    if (form.format === "embed" && !form.embedHtml.trim()) {
      setError("Cole o código HTML do anúncio de terceiros.")
      return
    }

    setSaving(true)
    setError("")
    setFeedback("")

    try {
      if (editingId) {
        await updatePlatformAd(editingId, form)
        setFeedback("Anúncio atualizado.")
      } else {
        await createPlatformAd(form)
        setFeedback("Anúncio criado.")
        startNew()
      }
      await loadAds()
    } catch {
      setError("Falha ao salvar. Confirme que você está logado como administrador.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Excluir este anúncio permanentemente?")) return
    setSaving(true)
    setError("")
    try {
      await deletePlatformAd(id)
      if (editingId === id) startNew()
      setFeedback("Anúncio removido.")
      await loadAds()
    } catch {
      setError("Não foi possível excluir.")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (ad: PlatformAd) => {
    try {
      await updatePlatformAd(ad.id, { active: !ad.active })
      await loadAds()
    } catch {
      setError("Não foi possível alterar o status.")
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-primary flex items-center gap-2">
          <Megaphone className="w-4 h-4" />
          Anúncios da plataforma
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Publique banners próprios ou código de terceiros (AdSense, parceiros, etc.). Só contas
          administradoras podem editar; visitantes veem apenas anúncios ativos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={startNew} className="rounded-lg">
          <Plus className="w-4 h-4 mr-1" />
          Novo anúncio
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void loadAds()} className="rounded-lg">
          Atualizar lista
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-border/50 p-2 bg-secondary/15">
          {ads.length === 0 ? (
            <li className="text-xs text-muted-foreground px-2 py-4 text-center">Nenhum anúncio cadastrado.</li>
          ) : (
            ads.map((ad) => (
              <li
                key={ad.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                  editingId === ad.id
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/40 hover:bg-secondary/30"
                }`}
              >
                <button
                  type="button"
                  onClick={() => startEdit(ad)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-xs font-semibold truncate">{ad.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {AD_PLACEMENT_LABELS[ad.placement]} · {AD_ORIGIN_LABELS[ad.origin]} ·{" "}
                    {ad.active ? "Ativo" : "Inativo"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(ad)}
                  className="text-primary shrink-0"
                  title={ad.active ? "Desativar" : "Ativar"}
                >
                  {ad.active ? (
                    <ToggleRight className="w-5 h-5" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(ad.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Excluir anúncio"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-4">
        <p className="text-xs font-bold text-foreground">
          {editingId ? "Editar anúncio" : "Criar anúncio"}
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium">Título interno (só para você)</label>
            <input
              value={form.title}
              onChange={(e) => patchForm("title", e.target.value)}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
              placeholder="Ex: Parceria AdvForte março"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Origem</label>
            <select
              value={form.origin}
              onChange={(e) => {
                const origin = e.target.value as AdOrigin
                patchForm("origin", origin)
                if (origin === "third_party" && form.format === "banner") {
                  patchForm("format", "embed")
                }
              }}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
            >
              {(Object.keys(AD_ORIGIN_LABELS) as AdOrigin[]).map((key) => (
                <option key={key} value={key}>
                  {AD_ORIGIN_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Formato</label>
            <select
              value={form.format}
              onChange={(e) => patchForm("format", e.target.value as AdFormat)}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
            >
              <option value="banner">Banner (imagem + texto + link)</option>
              <option value="embed">Código HTML (terceiros)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Onde exibir</label>
            <select
              value={form.placement}
              onChange={(e) => patchForm("placement", e.target.value as AdPlacement)}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
            >
              {(Object.keys(AD_PLACEMENT_LABELS) as AdPlacement[]).map((key) => (
                <option key={key} value={key}>
                  {AD_PLACEMENT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Ordem (menor = primeiro)</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => patchForm("sortOrder", Number(e.target.value) || 0)}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-medium">Rótulo exibido ao público</label>
            <input
              value={form.sponsorLabel}
              onChange={(e) => patchForm("sponsorLabel", e.target.value)}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
              placeholder="Patrocinado"
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => patchForm("active", e.target.checked)}
              className="rounded border-border"
            />
            Publicar (ativo no site)
          </label>
        </div>

        {form.format === "banner" ? (
          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium">Título do anúncio</label>
              <input
                value={form.headline}
                onChange={(e) => patchForm("headline", e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => patchForm("description", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-y"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium">URL da imagem</label>
              <input
                value={form.imageUrl}
                onChange={(e) => patchForm("imageUrl", e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Link de destino</label>
              <input
                value={form.linkUrl}
                onChange={(e) => patchForm("linkUrl", e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Texto do botão</label>
              <input
                value={form.ctaText}
                onChange={(e) => patchForm("ctaText", e.target.value)}
                className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <label className="text-xs font-medium">Código HTML / script (terceiros)</label>
            <textarea
              value={form.embedHtml}
              onChange={(e) => patchForm("embedHtml", e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs font-mono resize-y"
              placeholder="<ins>...</ins> ou iframe de parceiro"
            />
            <p className="text-[10px] text-muted-foreground">
              Use apenas códigos de fontes confiáveis. O HTML é renderizado como você colar.
            </p>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
        {feedback && <p className="text-xs text-primary">{feedback}</p>}

        <Button type="button" onClick={handleSave} disabled={saving} className="rounded-xl">
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {editingId ? "Salvar alterações" : "Criar anúncio"}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
