/** Agrupa notificações do mesmo tipo + publicação nas últimas 24h para exibição. */

export type JqNotifActor = {
  id: string;
  image: string | null;
  name: string;
  handle: string;
};

export type JqNotifFlat = {
  id: string;
  type: string;
  readAt: Date | null;
  createdAt: Date;
  publicationId: string | null;
  publicationPreview: string | null;
  actor: JqNotifActor | null;
};

export type JqNotifGrouped = {
  id: string;
  type: string;
  readAt: Date | null;
  createdAt: Date;
  publicationId: string | null;
  publicationPreview: string | null;
  actors: JqNotifActor[];
  totalActors: number;
  ids: string[];
};

const GROUPABLE = new Set(["LIKE", "REPLY", "MENTION", "FOLLOW"]);
const WINDOW_MS = 24 * 60 * 60 * 1000;

function groupKey(n: JqNotifFlat): string | null {
  if (!GROUPABLE.has(n.type)) return null;
  if (n.publicationId) return `${n.type}:${n.publicationId}`;
  if (n.type === "FOLLOW" && n.actor?.id) return `FOLLOW:${n.actor.id}`;
  return null;
}

function toGrouped(sorted: JqNotifFlat[]): JqNotifGrouped {
  const seen = new Set<string>();
  const actors: JqNotifActor[] = [];
  for (const n of sorted) {
    if (!n.actor || seen.has(n.actor.id)) continue;
    seen.add(n.actor.id);
    actors.push(n.actor);
  }
  const latest = sorted[0]!;
  const allRead = sorted.every((n) => n.readAt != null);
  return {
    id: latest.id,
    type: latest.type,
    readAt: allRead ? latest.readAt : null,
    createdAt: latest.createdAt,
    publicationId: latest.publicationId,
    publicationPreview: latest.publicationPreview,
    actors,
    totalActors: sorted.length,
    ids: sorted.map((n) => n.id),
  };
}

export function groupJqNotifications(items: JqNotifFlat[]): JqNotifGrouped[] {
  const out: JqNotifGrouped[] = [];
  let i = 0;

  while (i < items.length) {
    const n = items[i]!;
    const key = groupKey(n);
    if (!key || !n.actor) {
      out.push(toGrouped([n]));
      i++;
      continue;
    }

    const batch: JqNotifFlat[] = [n];
    let j = i + 1;
    while (j < items.length) {
      const next = items[j]!;
      if (groupKey(next) !== key || !next.actor) break;
      if (
        Math.abs(next.createdAt.getTime() - n.createdAt.getTime()) > WINDOW_MS
      ) {
        break;
      }
      batch.push(next);
      j++;
    }

    out.push(toGrouped(batch));
    i = j;
  }

  return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function formatGroupedActors(actors: JqNotifActor[], total: number): string {
  if (total <= 1) return actors[0]?.name ?? "Alguém";
  const names = actors.slice(0, 3).map((a) => a.name);
  if (total <= 3) return names.join(", ");
  const extra = total - names.length;
  return `${names.join(", ")} e mais ${extra} ${extra === 1 ? "pessoa" : "pessoas"}`;
}
