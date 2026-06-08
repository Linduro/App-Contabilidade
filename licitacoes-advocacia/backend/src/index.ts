import cron from "node-cron";
import app from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.port, () => {
  console.log(`[backend] API rodando em http://localhost:${env.port}`);
  console.log(`[backend] Ambiente: ${env.nodeEnv}`);
});

if (env.nodeEnv !== "test") {
  cron.schedule(env.cronCollectSchedule, async () => {
    try {
      const { runCollectAndMatch } = await import("./jobs/collectAndMatch.js");
      await runCollectAndMatch();
    } catch (error) {
      console.error("[cron:collectAndMatch] Erro:", error);
    }
  });

  console.log(`[cron] collectAndMatch: ${env.cronCollectSchedule}`);
}

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
