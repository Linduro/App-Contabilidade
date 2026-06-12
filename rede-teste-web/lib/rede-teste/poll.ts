import { z } from "zod";
import { randomUUID } from "crypto";

export const jqPollInputSchema = z.object({
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
  endsAt: z.coerce.date().optional(),
});

export type JqPollStored = {
  options: { id: string; label: string; votes: number }[];
  endsAt: string | null;
};

export function buildPollFromInput(input: z.infer<typeof jqPollInputSchema>): JqPollStored {
  return {
    options: input.options.map((label) => ({
      id: randomUUID().slice(0, 8),
      label: label.trim(),
      votes: 0,
    })),
    endsAt: input.endsAt?.toISOString() ?? null,
  };
}

export function parseJqPoll(raw: unknown): JqPollStored | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.options)) return null;
  const options = o.options
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      id: String(x.id ?? ""),
      label: String(x.label ?? ""),
      votes: Number(x.votes) || 0,
    }))
    .filter((x) => x.id && x.label);
  if (options.length < 2) return null;
  return {
    options,
    endsAt: typeof o.endsAt === "string" ? o.endsAt : null,
  };
}

export function pollIsOpen(poll: JqPollStored) {
  if (!poll.endsAt) return true;
  return new Date(poll.endsAt) > new Date();
}
