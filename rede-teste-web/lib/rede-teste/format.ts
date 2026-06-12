import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatJqHandle(handle: string) {
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export function formatJqRelativeTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: false, locale: ptBR })
    .replace("cerca de ", "")
    .replace("menos de um minuto", "agora");
}

export function slugifyHandle(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20) || "advogado";
}

export const PRACTICE_AREAS = [
  "Civil",
  "Penal",
  "Trabalhista",
  "Tributário",
  "Constitucional",
  "Administrativo",
  "Empresarial",
  "Previdenciário",
  "Consumidor",
  "Família",
] as const;
