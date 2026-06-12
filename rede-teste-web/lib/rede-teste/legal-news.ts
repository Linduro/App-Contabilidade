/** Fontes exibidas em "Hoje no Direito". */
export const LEGAL_NEWS_SOURCE_ORDER = [
  "ConJur",
  "InfoMoney",
  "Migalhas",
  "G1 Justiça",
] as const;

export type LegalNewsItem = {
  id: string;
  title: string;
  description: string;
  meta: string;
  url: string;
  source: string;
};

/** Embaralha (Fisher–Yates) sem mutar o array original. */
export function shuffleNews<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Seleciona até `max` notícias priorizando diversidade de fontes (round-robin).
 * Recebe a lista já na ordem desejada (ex.: embaralhada) e mantém essa ordem dentro de cada fonte.
 */
export function pickDiverseNews(items: LegalNewsItem[], max: number): LegalNewsItem[] {
  const bySource = new Map<string, LegalNewsItem[]>();
  for (const item of items) {
    const list = bySource.get(item.source) ?? [];
    list.push(item);
    bySource.set(item.source, list);
  }

  const sources = [...bySource.keys()];
  const picked: LegalNewsItem[] = [];
  let added = true;
  while (picked.length < max && added) {
    added = false;
    for (const source of sources) {
      const list = bySource.get(source);
      const next = list?.shift();
      if (next) {
        picked.push(next);
        added = true;
        if (picked.length >= max) break;
      }
    }
  }
  return picked;
}

/** Uma notícia por fonte, na ordem das fontes do widget; depois preenche até `max` sem repetir fonte. */
export function pickOneNewsPerSource(items: LegalNewsItem[], max: number): LegalNewsItem[] {
  const bySource = new Map<string, LegalNewsItem[]>();
  for (const item of items) {
    const list = bySource.get(item.source) ?? [];
    list.push(item);
    bySource.set(item.source, list);
  }

  const picked: LegalNewsItem[] = [];
  const usedSources = new Set<string>();

  for (const source of LEGAL_NEWS_SOURCE_ORDER) {
    const head = bySource.get(source)?.[0];
    if (!head) continue;
    picked.push(head);
    usedSources.add(source);
    if (picked.length >= max) return picked;
  }

  for (const item of items) {
    if (picked.length >= max) break;
    if (usedSources.has(item.source)) continue;
    picked.push(item);
    usedSources.add(item.source);
  }

  return picked;
}
