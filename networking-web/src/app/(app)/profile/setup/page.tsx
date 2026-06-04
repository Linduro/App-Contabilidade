"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExpertiseTag } from "@/components/profile/expertise-tag"
import { AREA_OPTIONS, EXPERTISE_CATALOG } from "@/constants/expertise-catalog"
import { api, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth-store"
import {
  setupStep1Schema,
  setupStep2Schema,
  setupStep3Schema,
  type ProfileUpdateInput,
} from "@/types/schemas"
import { z } from "zod"

type Step1 = z.infer<typeof setupStep1Schema>
type Step2 = z.infer<typeof setupStep2Schema>
type Step3 = z.infer<typeof setupStep3Schema>

export default function ProfileSetupPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)!
  const [step, setStep] = useState(1)
  const [customTag, setCustomTag] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Partial<ProfileUpdateInput>>({})

  const form1 = useForm<Step1>({
    resolver: zodResolver(setupStep1Schema),
    defaultValues: { areaAtuacao: [] },
  })

  const form2 = useForm<Step2>({
    resolver: zodResolver(setupStep2Schema),
    defaultValues: { expertises: [] },
  })

  const form3 = useForm<Step3>({
    resolver: zodResolver(setupStep3Schema),
    defaultValues: { disponivelMentoria: false },
  })

  const areas = form1.watch("areaAtuacao")
  const expertises = form2.watch("expertises")

  const toggleArea = (area: string) => {
    const next = areas.includes(area)
      ? areas.filter((a) => a !== area)
      : [...areas, area]
    form1.setValue("areaAtuacao", next, { shouldValidate: true })
  }

  const toggleExpertise = (tag: string) => {
    const next = expertises.includes(tag)
      ? expertises.filter((t) => t !== tag)
      : [...expertises, tag]
    form2.setValue("expertises", next, { shouldValidate: true })
  }

  const addCustomTag = () => {
    const t = customTag.trim()
    if (!t || expertises.includes(t)) return
    form2.setValue("expertises", [...expertises, t], { shouldValidate: true })
    setCustomTag("")
  }

  const finish = async (step3: Step3) => {
    setSubmitError(null)
    const payload: ProfileUpdateInput = {
      ...saved,
      oQueOfeco: step3.oQueOfeco,
      oQueBusco: step3.oQueBusco,
      bio: step3.bio || null,
      disponivelMentoria: step3.disponivelMentoria,
      linkedinUrl: step3.linkedinUrl || null,
    }

    try {
      await api.updateMyProfile(token, payload)
      await api.recalculateEmbedding(token).catch(() => undefined)
      router.push("/dashboard")
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Erro ao salvar")
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              "h-1 flex-1 rounded-full",
              s <= step ? "bg-indigo-600" : "bg-slate-200"
            )}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Etapa 1 — Dados profissionais</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={form1.handleSubmit((data) => {
                    setSaved((p) => ({
                      ...p,
                      cargoAtual: data.cargoAtual,
                      empresa: data.empresa,
                      areaAtuacao: data.areaAtuacao,
                      turma: data.turma ?? null,
                    }))
                    setStep(2)
                  })}
                >
                  <div className="space-y-2">
                    <Label>Cargo atual</Label>
                    <Input {...form1.register("cargoAtual")} />
                    {form1.formState.errors.cargoAtual && (
                      <p className="text-xs text-red-600">
                        {form1.formState.errors.cargoAtual.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Input {...form1.register("empresa")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Turma (opcional)</Label>
                    <Input {...form1.register("turma")} placeholder="Ex: 2024" />
                  </div>
                  <div className="space-y-2">
                    <Label>Áreas de atuação</Label>
                    <div className="flex flex-wrap gap-2">
                      {AREA_OPTIONS.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => toggleArea(area)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs",
                            areas.includes(area)
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-200"
                          )}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    Continuar
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Etapa 2 — Expertises</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={form2.handleSubmit((data) => {
                    setSaved((p) => ({ ...p, expertises: data.expertises }))
                    setStep(3)
                  })}
                >
                  <div className="flex flex-wrap gap-2">
                    {EXPERTISE_CATALOG.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleExpertise(tag)}
                        className={cn(
                          expertises.includes(tag) && "ring-2 ring-indigo-500 rounded-full"
                        )}
                      >
                        <ExpertiseTag label={tag} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      placeholder="Outra expertise"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addCustomTag()
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addCustomTag}>
                      Adicionar
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {expertises.map((t) => (
                      <ExpertiseTag key={t} label={t} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Voltar
                    </Button>
                    <Button type="submit" className="flex-1">
                      Continuar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle>Etapa 3 — Oferta e busca</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={form3.handleSubmit(finish)}
                >
                  <div className="space-y-2">
                    <Label>O que você oferece</Label>
                    <Textarea {...form3.register("oQueOfeco")} rows={4} />
                  </div>
                  <div className="space-y-2">
                    <Label>O que você busca</Label>
                    <Textarea {...form3.register("oQueBusco")} rows={4} />
                  </div>
                  <div className="space-y-2">
                    <Label>Bio (opcional)</Label>
                    <Textarea {...form3.register("bio")} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>LinkedIn (opcional)</Label>
                    <Input {...form3.register("linkedinUrl")} placeholder="https://..." />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" {...form3.register("disponivelMentoria")} />
                    Disponível para mentoria
                  </label>
                  {submitError && <p className="text-sm text-red-600">{submitError}</p>}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      Voltar
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={form3.formState.isSubmitting}
                    >
                      {form3.formState.isSubmitting ? "Salvando..." : "Concluir"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
