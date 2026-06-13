type BreakerState = {
  failures: number;
  openUntil: number;
};

const breakers = new Map<string, BreakerState>();

const DEFAULT_THRESHOLD = 3;
const OPEN_MS = 30_000;

export class CircuitOpenError extends Error {
  constructor(service: string) {
    super(`Serviço temporariamente indisponível (${service}). Tente novamente em instantes.`);
    this.name = "CircuitOpenError";
  }
}

export async function withCircuitBreaker<T>(
  service: string,
  fn: () => Promise<T>,
  opts: { threshold?: number; openMs?: number } = {},
): Promise<T> {
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const openMs = opts.openMs ?? OPEN_MS;
  const now = Date.now();
  const state = breakers.get(service) ?? { failures: 0, openUntil: 0 };

  if (state.openUntil > now) {
    throw new CircuitOpenError(service);
  }

  try {
    const result = await fn();
    breakers.set(service, { failures: 0, openUntil: 0 });
    return result;
  } catch (e) {
    const failures = state.failures + 1;
    const openUntil = failures >= threshold ? now + openMs : 0;
    breakers.set(service, { failures, openUntil });
    throw e;
  }
}
