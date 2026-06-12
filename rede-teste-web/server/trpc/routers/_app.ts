import { router } from "../trpc"
import { authRouter } from "./auth"
import { redeTesteRouter } from "./rede-teste"

/** Apenas rede social — sem módulos AdvForte. */
export const appRouter = router({
  auth: authRouter,
  redeTeste: redeTesteRouter,
})

export type AppRouter = typeof appRouter
