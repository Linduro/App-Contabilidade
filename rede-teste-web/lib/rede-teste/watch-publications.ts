/** IDs de publicações visíveis no viewport (feed) para polling SSE leve. */

const watched = new Set<string>();
const MAX = 20;

export function registerWatchedPublication(id: string) {
  watched.add(id);
  while (watched.size > MAX) {
    const first = watched.values().next().value;
    if (first) watched.delete(first);
  }
  return () => watched.delete(id);
}

export function getWatchedPublicationIds(): string[] {
  return [...watched];
}
