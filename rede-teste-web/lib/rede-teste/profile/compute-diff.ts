/** Atualização idempotente — só campos definidos e alterados. */
export function computeProfileDiff<T extends Record<string, unknown>>(
  current: T,
  input: Partial<T>,
): Partial<T> {
  const diff: Partial<T> = {};
  for (const key of Object.keys(input) as (keyof T)[]) {
    const next = input[key];
    if (next === undefined) continue;
    const prev = current[key];
    if (Array.isArray(next) && Array.isArray(prev)) {
      if (
        next.length !== prev.length ||
        next.some((v, i) => v !== (prev as unknown[])[i])
      ) {
        diff[key] = next;
      }
      continue;
    }
    if (next !== prev) {
      diff[key] = next;
    }
  }
  return diff;
}
