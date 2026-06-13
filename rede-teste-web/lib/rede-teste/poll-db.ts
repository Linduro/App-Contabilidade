import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";

export const jqPollInputSchema = z.object({
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
  durationDays: z.union([z.literal(1), z.literal(3), z.literal(7)]).default(1),
});

export type JqPollDto = {
  id: string;
  expiresAt: Date;
  options: { id: string; label: string; votes: number; position: number }[];
};

export function pollExpiresAt(durationDays: number, from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + durationDays);
  return d;
}

export function pollIsOpen(expiresAt: Date, now = new Date()): boolean {
  return expiresAt > now;
}

export async function createJqPoll(
  tx: Prisma.TransactionClient,
  publicationId: string,
  input: z.infer<typeof jqPollInputSchema>,
): Promise<void> {
  const expiresAt = pollExpiresAt(input.durationDays);
  const poll = await tx.redeTestePoll.create({
    data: {
      publicationId,
      durationDays: input.durationDays,
      expiresAt,
    },
  });

  await tx.redeTestePollOption.createMany({
    data: input.options.map((text, position) => ({
      id: randomUUID(),
      pollId: poll.id,
      text: text.trim(),
      position,
    })),
  });
}

export async function loadJqPollDto(
  prisma: PrismaClient,
  publicationId: string,
  viewerId: string | null,
): Promise<{ poll: JqPollDto | null; viewerOptionId: string | null }> {
  const row = await prisma.redeTestePoll.findUnique({
    where: { publicationId },
    include: {
      options: { orderBy: { position: "asc" } },
      votes: viewerId ? { where: { userId: viewerId }, take: 1 } : false,
    },
  });
  if (!row) return { poll: null, viewerOptionId: null };

  return {
    poll: {
      id: row.id,
      expiresAt: row.expiresAt,
      options: row.options.map((o) => ({
        id: o.id,
        label: o.text,
        votes: o.votesCount,
        position: o.position,
      })),
    },
    viewerOptionId: viewerId && row.votes[0] ? row.votes[0].pollOptionId : null,
  };
}

export async function loadJqPollDtosBatch(
  prisma: PrismaClient,
  publicationIds: string[],
  viewerId: string | null,
): Promise<Map<string, { poll: JqPollDto; viewerOptionId: string | null }>> {
  if (!publicationIds.length) return new Map();

  const rows = await prisma.redeTestePoll.findMany({
    where: { publicationId: { in: publicationIds } },
    include: {
      options: { orderBy: { position: "asc" } },
      votes: viewerId ? { where: { userId: viewerId } } : false,
    },
  });

  const map = new Map<string, { poll: JqPollDto; viewerOptionId: string | null }>();
  for (const row of rows) {
    map.set(row.publicationId, {
      poll: {
        id: row.id,
        expiresAt: row.expiresAt,
        options: row.options.map((o) => ({
          id: o.id,
          label: o.text,
          votes: o.votesCount,
          position: o.position,
        })),
      },
      viewerOptionId: viewerId && row.votes[0] ? row.votes[0].pollOptionId : null,
    });
  }
  return map;
}
