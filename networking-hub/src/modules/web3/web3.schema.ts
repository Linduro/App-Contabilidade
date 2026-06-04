import { z } from "zod"

export const linkWalletSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Endereço EVM inválido"),
})

export type LinkWalletInput = z.infer<typeof linkWalletSchema>
