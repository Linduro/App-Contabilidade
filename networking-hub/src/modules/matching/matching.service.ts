import { and, eq, isNotNull, ne, sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import { matchResults, profiles, type Profile } from "../../db/schema.js"
import { enqueueEmbeddingJob } from "../../lib/redis.js"
import { buildProfileEmbeddingText } from "./embedding-text.js"

export interface MatchBreakdown {
  semantic: number
  tagsShared: number
  complementarity: number
}

export interface MatchSuggestion {
  profile: Omit<Profile, "embedding">
  score: number
  distance: number
  breakdown: MatchBreakdown
}

function computeTagOverlap(a: string[], b: string[]): number {
  const setB = new Set(b.map((t) => t.toLowerCase()))
  return a.filter((t) => setB.has(t.toLowerCase())).length
}

function computeComplementarity(a: string[], b: string[]): number {
  const setA = new Set(a.map((t) => t.toLowerCase()))
  const uniqueInB = b.filter((t) => !setA.has(t.toLowerCase())).length
  const denom = Math.max(b.length, 1)
  return Math.min(1, uniqueInB / denom)
}

function toPublicProfile(profile: Profile): Omit<Profile, "embedding"> {
  const { embedding: _e, ...rest } = profile
  return rest
}

export async function getMatchSuggestions(userId: string): Promise<MatchSuggestion[]> {
  const own = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })

  if (!own?.embedding) {
    return []
  }

  const embeddingValues = own.embedding as number[]
  const vectorLiteral = `'[${embeddingValues.join(",")}]'::vector`

  const rows = await db
    .select({
      profile: profiles,
      distance: sql<number>`(${profiles.embedding} <=> ${sql.raw(vectorLiteral)})`.as("distance"),
    })
    .from(profiles)
    .where(and(ne(profiles.userId, userId), isNotNull(profiles.embedding)))
    .orderBy(sql`(${profiles.embedding} <=> ${sql.raw(vectorLiteral)})`)
    .limit(10)

  const suggestions: MatchSuggestion[] = rows.map((row) => {
    const semantic = Math.max(0, Math.min(1, 1 - Number(row.distance)))
    const tagsShared = computeTagOverlap(own.expertises, row.profile.expertises)
    const complementarity = computeComplementarity(own.areaAtuacao, row.profile.areaAtuacao)
    const score = Number(
      (semantic * 0.6 + Math.min(tagsShared / 5, 1) * 0.25 + complementarity * 0.15).toFixed(4)
    )

    const breakdown: MatchBreakdown = {
      semantic: Number(semantic.toFixed(4)),
      tagsShared,
      complementarity: Number(complementarity.toFixed(4)),
    }

    return {
      profile: toPublicProfile(row.profile),
      score,
      distance: Number(row.distance),
      breakdown,
    }
  })

  await cacheMatchResults(own.id, suggestions)

  return suggestions
}

async function cacheMatchResults(
  profileId: string,
  suggestions: MatchSuggestion[]
): Promise<void> {
  for (const item of suggestions) {
    await db
      .insert(matchResults)
      .values({
        profileId,
        matchedProfileId: item.profile.id,
        score: item.score,
        breakdown: item.breakdown,
      })
      .onConflictDoUpdate({
        target: [matchResults.profileId, matchResults.matchedProfileId],
        set: {
          score: item.score,
          breakdown: item.breakdown,
          computedAt: new Date(),
        },
      })
  }
}

export async function recalculateEmbeddingForUser(userId: string): Promise<void> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })

  if (!profile) {
    throw new MatchingServiceError("PROFILE_NOT_FOUND", "Perfil não encontrado", 404)
  }

  await enqueueEmbeddingJob(profile.id)
}

export class MatchingServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = "MatchingServiceError"
  }
}
