import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import scrapeLicitita, {
  parseLicititaHtml,
} from "../src/scrapers/licitita.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(
  __dirname,
  "../src/scrapers/__fixtures__/licitacoes.html",
);

function printResults(label, results) {
  console.log(`\n=== ${label} (${results.length} total) ===\n`);

  results.slice(0, 3).forEach((item, index) => {
    console.log(`--- Resultado ${index + 1} ---`);
    console.log(JSON.stringify(item, null, 2));
    console.log("");
  });
}

async function runLiveScrape() {
  console.log("Executando scrape ao vivo em https://www.licitita.com.br/licitacoes ...");
  const results = await scrapeLicitita();
  printResults("Scrape ao vivo", results);
  return results;
}

function runFixtureScrape() {
  console.log("Usando fixture local (__fixtures__/licitacoes.html) ...");
  const html = readFileSync(FIXTURE_PATH, "utf8");
  const results = parseLicititaHtml(html, {
    baseUrl: "https://www.licitita.com.br",
    filters: { tipo: "licitacao", area: "direito" },
  });

  console.log(
    `[licitita] Encontradas ${results.length} licitações (tipo=licitacao, area=direito)`,
  );

  printResults("Scrape via fixture", results);
  return results;
}

async function main() {
  const useFixture = process.argv.includes("--fixture");

  try {
    if (useFixture) {
      runFixtureScrape();
      return;
    }

    await runLiveScrape();
  } catch (error) {
    console.error("\n[test] Scrape ao vivo falhou:");
    console.error(error instanceof Error ? error.message : error);
    console.error("\n[test] Tentando fixture local para validar o parser...\n");
    runFixtureScrape();
    process.exitCode = 1;
  }
}

main();
