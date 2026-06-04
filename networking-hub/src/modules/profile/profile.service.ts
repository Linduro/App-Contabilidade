import { and, arrayContains, count, desc, eq, ilike, ne, sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import { profiles, type Profile } from "../../db/schema.js"
import { enqueueEmbeddingJob } from "../../lib/redis.js"
import type { ProfileListQuery, ProfileUpdateInput } from "./profile.schema.js"

const PAGE_SIZE = 20

export type PublicProfile = Omit<Profile, "embedding" | "userId"> & {
  embedding?: never
}

export function toPublicProfile(profile: Profile): PublicProfile {
  const { embedding: _e, userId: _u, ...rest } = profile
  return rest
}

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const row = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })
  return row ?? null
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const row = await db.query.profiles.findFirst({
    where: eq(profiles.id, id),
  })
  return row ?? null
}

export async function updateOwnProfile(
  userId: string,
  input: ProfileUpdateInput
): Promise<Profile> {
  const existing = await getProfileByUserId(userId)
  if (!existing) {
    throw new ProfileServiceError("PROFILE_NOT_FOUND", "Perfil não encontrado", 404)
  }

  const patch: Partial<typeof profiles.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (input.nome !== undefined) patch.nome = input.nome
  if (input.turma !== undefined) patch.turma = input.turma
  if (input.cargoAtual !== undefined) patch.cargoAtual = input.cargoAtual
  if (input.empresa !== undefined) patch.empresa = input.empresa
  if (input.areaAtuacao !== undefined) patch.areaAtuacao = input.areaAtuacao
  if (input.expertises !== undefined) patch.expertises = input.expertises
  if (input.oQueOfeco !== undefined) patch.oQueOfeco = input.oQueOfeco
  if (input.oQueBusco !== undefined) patch.oQueBusco = input.oQueBusco
  if (input.linkedinUrl !== undefined) patch.linkedinUrl = input.linkedinUrl
  if (input.disponivelMentoria !== undefined) patch.disponivelMentoria = input.disponivelMentoria
  if (input.bio !== undefined) patch.bio = input.bio
  if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl

  const [updated] = await db
    .update(profiles)
    .set(patch)
    .where(eq(profiles.id, existing.id))
    .returning()

  if (!updated) {
    throw new Error("Falha ao atualizar perfil")
  }

  await enqueueEmbeddingJob(updated.id)

  return updated
}

export async function listProfiles(query: ProfileListQuery) {
  const conditions = []

  if (query.area) {
    conditions.push(arrayContains(profiles.areaAtuacao, [query.area]))
  }

  if (query.mentoria === true) {
    conditions.push(eq(profiles.disponivelMentoria, true))
  }

  if (query.turma) {
    conditions.push(ilike(profiles.turma, `%${query.turma}%`))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const offset = (query.page - 1) * PAGE_SIZE

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(profiles)
      .where(whereClause)
      .orderBy(desc(profiles.updatedAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(profiles).where(whereClause),
  ])

  const total = totalRow[0]?.total ?? 0

  return {
    data: rows.map(toPublicProfile),
    pagination: {
      page: query.page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
    },
  }
}

export async function getPublicProfileById(id: string): Promise<PublicProfile | null> {
  const profile = await getProfileById(id)
  if (!profile) return null
  return toPublicProfile(profile)
}

export class ProfileServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = "ProfileServiceError"
  }
}
