import { z } from "zod"

export const createConnectionSchema = z.object({
  targetProfileId: z.string().uuid("ID de perfil inválido"),
})

export const updateConnectionSchema = z.object({
  status: z.enum(["aceita", "ignorada"]),
})

export const connectionListQuerySchema = z.object({
  status: z.enum(["pendente", "aceita", "ignorada"]).optional(),
})

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>
export type UpdateConnectionInput = z.infer<typeof updateConnectionSchema>
export type ConnectionListQuery = z.infer<typeof connectionListQuerySchema>
