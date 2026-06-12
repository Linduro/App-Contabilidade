import { TRPCError } from "@trpc/server";
import { checkRateLimit } from "@/lib/rate-limit";

export function assertJqRateLimit(
  userId: string,
  action: string,
  max: number,
  windowMs: number,
): void {
  const { ok, retryAfterSec } = checkRateLimit(`jq:${action}:${userId}`, max, windowMs);
  if (!ok) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: retryAfterSec
        ? `Muitas tentativas. Aguarde ${retryAfterSec}s.`
        : "Muitas tentativas. Tente novamente em instantes.",
    });
  }
}
