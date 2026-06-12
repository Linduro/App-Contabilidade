import { headers } from "next/headers";
import { appRouter } from "@/server/trpc/routers/_app";
import { createCallerFactory } from "@/server/trpc/trpc";
import { createTRPCContext } from "@/server/trpc/context";

const createCaller = createCallerFactory(appRouter);

export async function getTRPCCaller() {
  const reqHeaders = await headers();
  const ctx = await createTRPCContext({
    req: { headers: reqHeaders } as Request,
  });
  return createCaller(ctx);
}
