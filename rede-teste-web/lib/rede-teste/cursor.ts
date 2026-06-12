import { z } from "zod";

export const jqCursorSchema = z
  .object({
    id: z.string().cuid(),
    createdAt: z.coerce.date(),
  })
  .optional();

export type JqCursor = z.infer<typeof jqCursorSchema>;

/** Cursor do feed "Para você" (JurisRank). */
export const jqRankCursorSchema = z.object({
  finalScore: z.number(),
  createdAt: z.coerce.date(),
  id: z.string().cuid(),
});

export type JqRankCursor = z.infer<typeof jqRankCursorSchema>;

/** Cursor paginado do feed Rede Teste (cronológico ou JurisRank). */
export const jqFeedCursorSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("chrono"),
      id: z.string().cuid(),
      createdAt: z.coerce.date(),
    }),
    jqRankCursorSchema.extend({ kind: z.literal("rank") }),
  ])
  .optional();

export type JqFeedCursor = z.infer<typeof jqFeedCursorSchema>;

export function jqCursorWhere(cursor: JqCursor | undefined) {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}
