import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const classifierScript = join(backendRoot, "src/classifier/classifier.py");

const pythonPath = process.env.PYTHON_PATH ?? "python";
const minConfidence = parseFloat(process.env.CLASSIFIER_MIN_CONFIDENCE ?? "0.3");
const timeoutMs = parseInt(process.env.CLASSIFIER_TIMEOUT_MS ?? "30000", 10);
const classifierUrl = process.env.CLASSIFIER_URL || null;

/**
 * @param {string} texto
 * @returns {Promise<Array<{ especialidade: string, score: number }>>}
 */
export async function classifyText(texto) {
  const trimmed = texto.trim();
  if (!trimmed) return [];

  if (classifierUrl) {
    const response = await fetch(classifierUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto: trimmed, min_confidence: minConfidence }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Classificador HTTP retornou ${response.status}`);
    }

    const payload = await response.json();
    return payload.especialidades ?? [];
  }

  return classifyViaPython(trimmed);
}

/**
 * @param {string} texto
 * @returns {Promise<Array<{ especialidade: string, score: number }>>}
 */
function classifyViaPython(texto) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, [classifierScript], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Classificador excedeu timeout de ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`Falha ao iniciar Python: ${error.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(stderr.trim() || `Classificador encerrou com código ${code}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed.especialidades ?? []);
      } catch {
        reject(new Error("Resposta inválida do classificador Python"));
      }
    });

    child.stdin.write(
      JSON.stringify({ texto, min_confidence: minConfidence }),
    );
    child.stdin.end();
  });
}
