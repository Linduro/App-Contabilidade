import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/routers/_app";
import { createTRPCContext } from "@/server/trpc/context";
import { captureException } from "@/lib/observability";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ req }),
    onError({ error, path }) {
      if (process.env.NODE_ENV === "production") {
        captureException(error);
        console.error(`[trpc] ${path}:`, error.message);
      }
    },
  });

export { handler as GET, handler as POST };
