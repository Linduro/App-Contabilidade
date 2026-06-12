export const JQ_COMPOSER_MAX_CHARS = 560;
export const JQ_POLL_OPTION_MAX = 80;
export const JQ_POLL_MAX_OPTIONS = 4;
export const JQ_THREAD_MAX_PARTS = 10;
export const JQ_SCHEDULE_MIN_MS = 5 * 60 * 1000;
export const JQ_SCHEDULE_MAX_MS = 183 * 24 * 60 * 60 * 1000; // ~6 meses

export type ComposerMode = "normal" | "poll";

export function countComposerChars(text: string): number {
  return [...text].length;
}

export function validatePollOptions(options: string[]): string | null {
  const trimmed = options.map((o) => o.trim()).filter((o) => o.length > 0);
  if (trimmed.length < 2) return "Informe pelo menos 2 opções na enquete.";
  if (trimmed.length > JQ_POLL_MAX_OPTIONS) return "Máximo de 4 opções.";
  const seen = new Set<string>();
  for (const o of trimmed) {
    const key = o.toLowerCase();
    if (seen.has(key)) return "Opções duplicadas não são permitidas.";
    seen.add(key);
    if (o.length > JQ_POLL_OPTION_MAX) return `Cada opção pode ter até ${JQ_POLL_OPTION_MAX} caracteres.`;
  }
  return null;
}

export function composerMediaConflict(hasUploadMedia: boolean, hasGif: boolean): boolean {
  return hasUploadMedia && hasGif;
}

export function composerPollConflict(mode: ComposerMode, hasMedia: boolean): boolean {
  return mode === "poll" && hasMedia;
}

export function validateScheduledAt(date: Date, now = new Date()): string | null {
  const ms = date.getTime() - now.getTime();
  if (ms < JQ_SCHEDULE_MIN_MS) return "Agende com pelo menos 5 minutos de antecedência.";
  if (ms > JQ_SCHEDULE_MAX_MS) return "Agendamento limitado a 6 meses no futuro.";
  return null;
}

export function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m?.[0] ?? null;
}
