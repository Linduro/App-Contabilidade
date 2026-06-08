"use client"

import { useState } from "react"
import { Loader2, Save } from "lucide-react"
import type { TrabalhistaSettings } from "@/lib/trabalhista-leads/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ConfigPanelProps {
  settings: TrabalhistaSettings
  saving: boolean
  onSave: (settings: TrabalhistaSettings) => Promise<void>
}

export function ConfigPanel({ settings, saving, onSave }: ConfigPanelProps) {
  const [form, setForm] = useState(settings)
  const [open, setOpen] = useState(false)

  const patch = (partial: Partial<TrabalhistaSettings>) => {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  return (
    <section className="rounded-xl border bg-card">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
        onClick={() => setOpen((v) => !v)}
      >
        Configuração online (Firestore)
        <span className="text-xs font-normal text-muted-foreground">
          {form.enabled ? "Ativo" : "Inativo"} — {open ? "recolher" : "expandir"}
        </span>
      </button>

      {open && (
        <div className="space-y-6 border-t p-4">
          <p className="text-xs text-muted-foreground">
            Tudo fica em <code className="text-foreground">trabalhistaConfig/settings</code>.
            O worker na nuvem (GitHub Actions) lê daqui — nada no seu PC.
          </p>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
              />
              Módulo ativo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.collect_enabled}
                onChange={(e) => patch({ collect_enabled: e.target.checked })}
              />
              Coleta Datajud
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.outreach_enabled}
                onChange={(e) => patch({ outreach_enabled: e.target.checked })}
              />
              Disparos automáticos
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Datajud API Key">
              <Input
                type="password"
                value={form.datajud_api_key}
                onChange={(e) => patch({ datajud_api_key: e.target.value })}
                placeholder="APIKey do CNJ"
              />
            </Field>
            <Field label="TRTs (vírgula)">
              <Input
                value={form.datajud_trts}
                onChange={(e) => patch({ datajud_trts: e.target.value })}
                placeholder="1,2,3,15"
              />
            </Field>
            <Field label="Dias retroativos">
              <Input
                type="number"
                min={1}
                max={90}
                value={form.datajud_days_back}
                onChange={(e) =>
                  patch({ datajud_days_back: parseInt(e.target.value, 10) || 7 })
                }
              />
            </Field>
            <Field label="Score mín. outreach">
              <Input
                type="number"
                min={0}
                max={100}
                value={form.min_score_for_outreach}
                onChange={(e) =>
                  patch({
                    min_score_for_outreach: parseInt(e.target.value, 10) || 40,
                  })
                }
              />
            </Field>
          </div>

          <h3 className="text-sm font-medium">Evolution API (WhatsApp)</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="URL">
              <Input
                value={form.evolution_api_url}
                onChange={(e) => patch({ evolution_api_url: e.target.value })}
                placeholder="https://..."
              />
            </Field>
            <Field label="API Key">
              <Input
                type="password"
                value={form.evolution_api_key}
                onChange={(e) => patch({ evolution_api_key: e.target.value })}
              />
            </Field>
            <Field label="Instância">
              <Input
                value={form.evolution_instance}
                onChange={(e) => patch({ evolution_instance: e.target.value })}
              />
            </Field>
          </div>

          <h3 className="text-sm font-medium">E-mail (SMTP)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Host">
              <Input
                value={form.smtp_host}
                onChange={(e) => patch({ smtp_host: e.target.value })}
              />
            </Field>
            <Field label="Porta">
              <Input
                type="number"
                value={form.smtp_port}
                onChange={(e) =>
                  patch({ smtp_port: parseInt(e.target.value, 10) || 587 })
                }
              />
            </Field>
            <Field label="Usuário">
              <Input
                value={form.smtp_user}
                onChange={(e) => patch({ smtp_user: e.target.value })}
              />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                value={form.smtp_pass}
                onChange={(e) => patch({ smtp_pass: e.target.value })}
              />
            </Field>
            <Field label="Remetente">
              <Input
                value={form.smtp_from}
                onChange={(e) => patch({ smtp_from: e.target.value })}
              />
            </Field>
          </div>

          <h3 className="text-sm font-medium">Templates</h3>
          <div className="grid gap-4">
            <Field label="WhatsApp ({empresa}, {responsavel}, {processo}, {vara}, {valor})">
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={2}
                value={form.whatsapp_template}
                onChange={(e) => patch({ whatsapp_template: e.target.value })}
              />
            </Field>
            <Field label="Assunto e-mail">
              <Input
                value={form.email_subject}
                onChange={(e) => patch({ email_subject: e.target.value })}
              />
            </Field>
            <Field label="Corpo e-mail">
              <textarea
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={form.email_template}
                onChange={(e) => patch({ email_template: e.target.value })}
              />
            </Field>
          </div>

          <Button disabled={saving} onClick={() => onSave(form)}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar configuração
          </Button>
        </div>
      )}
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
