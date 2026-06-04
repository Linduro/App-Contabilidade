import { z } from "zod"

/** Espelha networking-hub/src/modules/profile/profile.schema.ts */
export const profileUpdateSchema = z.object({
  nome: z.string().min(2).max(120).optional(),
  turma: z.string().max(80).optional().nullable(),
  cargoAtual: z.string().max(120).optional().nullable(),
  empresa: z.string().max(120).optional().nullable(),
  areaAtuacao: z.array(z.string().min(1).max(80)).max(20).optional(),
  expertises: z.array(z.string().min(1).max(80)).max(30).optional(),
  oQueOfeco: z.string().max(2000).optional().nullable(),
  oQueBusco: z.string().max(2000).optional().nullable(),
  linkedinUrl: z.string().url().max(500).optional().nullable(),
  disponivelMentoria: z.boolean().optional(),
  bio: z.string().max(3000).optional().nullable(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
})

export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  nome: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
})

export type RegisterInput = z.infer<typeof registerSchema>

export const setupStep1Schema = z.object({
  cargoAtual: z.string().min(1, "Informe o cargo"),
  empresa: z.string().min(1, "Informe a empresa"),
  areaAtuacao: z.array(z.string().min(1)).min(1, "Selecione ao menos uma área"),
  turma: z.string().optional(),
})

export const setupStep2Schema = z.object({
  expertises: z.array(z.string().min(1)).min(1, "Adicione ao menos uma expertise"),
})

export const setupStep3Schema = z.object({
  oQueOfeco: z.string().min(10, "Descreva o que você oferece"),
  oQueBusco: z.string().min(10, "Descreva o que você busca"),
  bio: z.string().optional(),
  disponivelMentoria: z.boolean(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
})
