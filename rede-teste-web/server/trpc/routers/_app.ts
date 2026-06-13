import { router } from "../trpc"
import { authRouter } from "./auth"
import { redeTesteRouter } from "./rede-teste"
import { jurisdicaoRouter } from "./jurisdicao"

/** Apenas rede social — sem módulos AdvForte. */
export const appRouter = router({
  auth: authRouter,
  redeTeste: redeTesteRouter,
  jurisdicao: jurisdicaoRouter,
})

export type AppRouter = typeof appRouter
