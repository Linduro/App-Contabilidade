const KEY = "jq_view_session";

export function getOrCreateJqViewSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `jq_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `jq_${Date.now()}`;
  }
}
