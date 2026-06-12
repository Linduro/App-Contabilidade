const KEY = "juridiques:search-history";
const MAX = 12;

export function loadSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

export function pushSearchHistory(term: string) {
  if (typeof window === "undefined") return;
  const q = term.trim();
  if (!q) return;
  const next = [q, ...loadSearchHistory().filter((t) => t !== q)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function removeSearchHistoryItem(term: string) {
  if (typeof window === "undefined") return;
  const next = loadSearchHistory().filter((t) => t !== term);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearSearchHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
