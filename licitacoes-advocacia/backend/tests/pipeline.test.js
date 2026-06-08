import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { jest } from "@jest/globals";
import request from "supertest";
import { parseLicititaHtml } from "../src/scrapers/licitita.js";
import { createInMemorySupabase } from "./helpers/inMemoryDb.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_HTML = readFileSync(
  join(__dirname, "../src/scrapers/__fixtures__/licitacoes.html"),
  "utf8",
);
const CLASSIFIER_SCRIPT = join(
  __dirname,
  "../src/classifier/classifier.py",
);

const DUPLICATE_HTML = `<!DOCTYPE html><html><body><main class="licitacoes-list">
<article class="licitacao-card" data-tipo="licitacao" data-area="direito"
  data-titulo="Duplicada A" data-valor="R$ 10.000,00" data-cidade="SP - SP" data-deadline="2026-08-01">
  <h2><a href="/licitacoes/mesmo-edital">Duplicada A</a></h2>
</article>
<article class="licitacao-card" data-tipo="licitacao" data-area="direito"
  data-titulo="Duplicada B" data-valor="R$ 20.000,00" data-cidade="RJ - RJ" data-deadline="2026-08-02">
  <h2><a href="/licitacoes/mesmo-edital">Duplicada B</a></h2>
</article>
</main></body></html>`;

function runPythonClassifier(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn("python", [CLASSIFIER_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python exit ${code}`));
        return;
      }
      resolve(JSON.parse(stdout));
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

describe("Pipeline E2E", () => {
  describe("1. Scraper", () => {
    it("extrai titulo, descricao, valor, cidade e deadline do HTML mockado", () => {
      const results = parseLicititaHtml(FIXTURE_HTML, {
        baseUrl: "https://www.licitita.com.br",
        filters: { tipo: "licitacao", area: "direito" },
      });

      expect(results.length).toBeGreaterThanOrEqual(1);

      const first = results[0];
      expect(first.titulo).toBe(
        "Contratação de assessoria jurídica especializada",
      );
      expect(first.descricao).toContain("consultoria");
      expect(first.valor).toBe("R$ 180.000,00");
      expect(first.cidade).toBe("Curitiba - PR");
      expect(first.deadline).toBe("2026-06-20");
      expect(first.url).toContain("contratacao-assessoria-juridica-curitiba");
    });

    it("deduplica licitações pela hash MD5 da URL", () => {
      const results = parseLicititaHtml(DUPLICATE_HTML, {
        baseUrl: "https://www.licitita.com.br",
        filters: { tipo: "licitacao", area: "direito" },
      });

      expect(results).toHaveLength(1);
      expect(results[0].hash).toHaveLength(32);
      expect(results[0].url).toBe(
        "https://www.licitita.com.br/licitacoes/mesmo-edital",
      );
    });
  });

  describe("2. Classificador", () => {
    it("detecta banking_law com score acima de 0.3", async () => {
      const result = await runPythonClassifier({
        texto:
          "Contratação de serviços bancários, assessoria de crédito e hipoteca junto à financeira.",
        min_confidence: 0.3,
      });

      const banking = result.especialidades.find(
        (item) => item.especialidade === "banking_law",
      );

      expect(banking).toBeDefined();
      expect(banking.score).toBeGreaterThan(0.3);
    });

    it("exclui especialidades com score abaixo do limiar", async () => {
      const result = await runPythonClassifier({
        texto: "Fornecimento de material de escritório e papel A4.",
        min_confidence: 0.3,
      });

      expect(result.especialidades).toEqual([]);
    });
  });

  describe("3. Matching", () => {
    let mockDb;
    let runMatchingForLicitacao;

    beforeEach(async () => {
      mockDb = createInMemorySupabase({
        especialidades_advogados: [
          {
            id: "esp-banking",
            slug: "banking_law",
            nome: "Direito Bancário",
            ativo: true,
          },
        ],
        advogados: [
          {
            id: "adv-1",
            nome: "Dr. Banking",
            email: "banking@test.com",
            ativo: true,
          },
        ],
        advogados_especialidades: [
          {
            advogado_id: "adv-1",
            especialidade_id: "esp-banking",
          },
        ],
        licitacoes: [
          {
            id: "lic-1",
            titulo: "Assessoria bancária",
            hash_conteudo: "abc123",
          },
        ],
        matches: [],
      });

      jest.unstable_mockModule("../src/lib/supabaseClient.js", () => ({
        getSupabaseClient: () => mockDb,
        isSupabaseConfigured: () => true,
      }));

      jest.unstable_mockModule("../src/lib/classifyText.js", () => ({
        classifyText: async () => [
          { especialidade: "banking_law", score: 0.72 },
        ],
      }));

      ({ runMatchingForLicitacao } = await import(
        "../src/jobs/collectAndMatch.js"
      ));
    });

    afterEach(() => {
      jest.resetModules();
      jest.clearAllMocks();
    });

    it("cria 1 match com relevancia_score acima de 50%", async () => {
      const scrapedItem = {
        titulo: "Assessoria bancária e crédito",
        descricao: "Serviços para instituição financeira",
        valor: "R$ 250.000,00",
        cidade: "São Paulo - SP",
        deadline: "2026-09-01",
        url: "https://www.licitita.com.br/licitacoes/banking",
        hash: "hash-banking",
        tipo: "licitacao",
        area: "direito",
        fonte: "licitita",
      };

      const especialidadesBySlug = new Map([["banking_law", "esp-banking"]]);
      const created = await runMatchingForLicitacao(
        scrapedItem,
        "lic-1",
        especialidadesBySlug,
      );

      expect(created).toBe(1);
      expect(mockDb._tables.matches).toHaveLength(1);

      const match = mockDb._tables.matches[0];
      expect(match.advogado_id).toBe("adv-1");
      expect(match.especialidade_id).toBe("esp-banking");
      expect(match.relevancia_score).toBeGreaterThan(0.5);
      expect(Math.round(match.relevancia_score * 100)).toBeGreaterThan(50);
    });
  });

  describe("4. Notificação", () => {
    let mockDb;
    let runNotifications;
    let sendMatchNotificationEmail;

    beforeEach(async () => {
      mockDb = createInMemorySupabase({
        advogados: [
          {
            id: "adv-1",
            nome: "Dr. Notify",
            email: "notify@test.com",
            ativo: true,
          },
        ],
        licitacoes: [
          {
            id: "lic-1",
            titulo: "Licitação teste",
            valor_estimado: 100000,
            municipio: "Curitiba",
            uf: "PR",
            data_encerramento: "2026-10-01",
            url_fonte: "https://www.licitita.com.br/licitacoes/teste",
            dados_brutos: { valor: "R$ 100.000,00", cidade: "Curitiba - PR" },
          },
        ],
        especialidades_advogados: [
          { id: "esp-1", nome: "Direito Bancário", slug: "banking_law" },
        ],
        matches: [
          {
            id: "match-1",
            licitacao_id: "lic-1",
            advogado_id: "adv-1",
            especialidade_id: "esp-1",
            relevancia_score: 0.8,
            notificado: false,
          },
        ],
      });

      sendMatchNotificationEmail = jest.fn(async () => ({ id: "email-1" }));

      jest.unstable_mockModule("../src/lib/supabaseClient.js", () => ({
        getSupabaseClient: () => mockDb,
        isSupabaseConfigured: () => true,
      }));

      jest.unstable_mockModule("../src/services/email.js", () => ({
        sendMatchNotificationEmail,
        isEmailConfigured: () => true,
      }));

      ({ runNotifications } = await import("../src/jobs/collectAndMatch.js"));
    });

    afterEach(() => {
      jest.resetModules();
      jest.clearAllMocks();
    });

    it("envia e-mail e marca matches como notificado=true", async () => {
      const stats = await runNotifications();

      expect(stats.emailsEnviados).toBe(1);
      expect(sendMatchNotificationEmail).toHaveBeenCalledTimes(1);
      expect(sendMatchNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "notify@test.com",
          advogadoNome: "Dr. Notify",
        }),
      );

      expect(mockDb._tables.matches[0].notificado).toBe(true);
      expect(mockDb._tables.matches[0].notificado_em).toBeDefined();
    });
  });

  describe("5. API smoke (Supertest)", () => {
    it("GET /api/health retorna status ok", async () => {
      const { default: app } = await import("../dist/app.js");
      const response = await request(app).get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
    });
  });
});
