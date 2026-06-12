/** Uma entrada por slug — prioriza comunidade em que o usuário já é membro, senão a com mais membros. */
export function dedupeJqCommunitiesBySlug<
  T extends { slug: string; membersCount: number; members: { role: string }[] },
>(rows: T[]): T[] {
  const bySlug = new Map<string, T>();
  for (const c of rows) {
    const prev = bySlug.get(c.slug);
    if (!prev) {
      bySlug.set(c.slug, c);
      continue;
    }
    const memberHere = c.members.length > 0;
    const memberPrev = prev.members.length > 0;
    if (memberHere && !memberPrev) {
      bySlug.set(c.slug, c);
      continue;
    }
    if (!memberHere && memberPrev) continue;
    if (c.membersCount > prev.membersCount) bySlug.set(c.slug, c);
  }
  return Array.from(bySlug.values());
}
