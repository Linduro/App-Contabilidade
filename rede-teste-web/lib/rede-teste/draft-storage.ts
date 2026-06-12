const ACTIVE_KEY = (userId: string) => `juridiques:draft:active:${userId}`;
const RECENT_EMOJI_KEY = "juridiques:emoji:recent";

export type JqActiveDraft = {
  content: string;
  practiceArea?: string;
  isConfidential?: boolean;
  courtId?: string | null;
  updatedAt: string;
};

export function loadActiveDraft(userId: string): JqActiveDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_KEY(userId));
    if (!raw) return null;
    return JSON.parse(raw) as JqActiveDraft;
  } catch {
    return null;
  }
}

export function saveActiveDraft(userId: string, draft: Omit<JqActiveDraft, "updatedAt">) {
  if (typeof window === "undefined") return;
  const payload: JqActiveDraft = { ...draft, updatedAt: new Date().toISOString() };
  localStorage.setItem(ACTIVE_KEY(userId), JSON.stringify(payload));
}

export function clearActiveDraft(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_KEY(userId));
}

export function loadRecentEmojis(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_EMOJI_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function pushRecentEmoji(emoji: string) {
  if (typeof window === "undefined") return;
  const prev = loadRecentEmojis().filter((e) => e !== emoji);
  const next = [emoji, ...prev].slice(0, 24);
  localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(next));
}
