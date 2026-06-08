import { runCollectAndMatch } from "../jobs/collectAndMatch.js";

runCollectAndMatch()
  .then((stats) => {
    console.log("[job:collectAndMatch] Stats:", stats);
    process.exit(stats.erros > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("[job:collectAndMatch] Falha fatal:", error);
    process.exit(1);
  });
