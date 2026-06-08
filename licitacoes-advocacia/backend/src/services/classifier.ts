import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

export interface EspecialidadeClassificada {
  especialidade: string;
  score: number;
}

export interface ClassifyResponse {
  especialidades: EspecialidadeClassificada[];
}

export class ClassifierError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 503,
  ) {
    super(message);
    this.name = "ClassifierError";
  }
}

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const classifierScript = join(backendRoot, "src/classifier/classifier.py");

async function classifyViaHttp(texto: string): Promise<ClassifyResponse> {
  const response = await fetch(env.classifierUrl!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      texto,
      min_confidence: env.classifierMinConfidence,
    }),
    signal: AbortSignal.timeout(env.classifierTimeoutMs),
  });

  if (!response.ok) {
    throw new ClassifierError(
      `Serviço de classificação retornou HTTP ${response.status}.`,
      "CLASSIFIER_HTTP_ERROR",
      502,
    );
  }

  const payload = (await response.json()) as ClassifyResponse;
  return {
    especialidades: payload.especialidades ?? [],
  };
}

function classifyViaPython(texto: string): Promise<ClassifyResponse> {
  return new Promise((resolve, reject) => {
    const pythonBin = env.pythonPath;
    const child = spawn(pythonBin, [classifierScript], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new ClassifierError(
          `Classificador excedeu timeout de ${env.classifierTimeoutMs}ms.`,
          "CLASSIFIER_TIMEOUT",
        ),
      );
    }, env.classifierTimeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(
        new ClassifierError(
          `Falha ao iniciar Python (${pythonBin}): ${error.message}`,
          "CLASSIFIER_SPAWN_ERROR",
        ),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        let detail = stderr.trim();

        try {
          const parsed = JSON.parse(stderr) as { error?: string; detail?: string };
          detail = parsed.detail ?? parsed.error ?? detail;
        } catch {
          // stderr não é JSON
        }

        reject(
          new ClassifierError(
            detail || `Classificador Python encerrou com código ${code}.`,
            code === 2 ? "CLASSIFIER_MODEL_MISSING" : "CLASSIFIER_PROCESS_ERROR",
          ),
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as ClassifyResponse;
        resolve({
          especialidades: parsed.especialidades ?? [],
        });
      } catch {
        reject(
          new ClassifierError(
            "Resposta inválida do classificador Python.",
            "CLASSIFIER_INVALID_OUTPUT",
          ),
        );
      }
    });

    child.stdin.write(
      JSON.stringify({
        texto,
        min_confidence: env.classifierMinConfidence,
      }),
    );
    child.stdin.end();
  });
}

export async function classifyText(
  texto: string,
): Promise<EspecialidadeClassificada[]> {
  const trimmed = texto.trim();

  if (!trimmed) {
    return [];
  }

  const result = env.classifierUrl
    ? await classifyViaHttp(trimmed)
    : await classifyViaPython(trimmed);

  return result.especialidades;
}
