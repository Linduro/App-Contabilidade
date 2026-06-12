const HIDDEN_KEY = "jq-legal-news-hidden";

export function loadHiddenLegalNewsIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function hideLegalNewsItem(id: string) {
  if (typeof window === "undefined") return;
  const next = [...new Set([...loadHiddenLegalNewsIds(), id])];
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
}
