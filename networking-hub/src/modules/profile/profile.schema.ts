import { z } from "zod"

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

export const profileListQuerySchema = z.object({
  area: z.string().optional(),
  mentoria: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  turma: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
})

export type ProfileListQuery = z.infer<typeof profileListQuerySchema>
