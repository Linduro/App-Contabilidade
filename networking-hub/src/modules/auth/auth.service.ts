import { hashPassword, verifyPassword } from "better-auth/crypto"
import { eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import { profiles, sessions, users, type User } from "../../db/schema.js"
import { enqueueEmbeddingJob } from "../../lib/redis.js"

export interface AuthUserDto {
  id: string
  email: string
  nome: string
  profileId: string | null
}

export interface AuthResult {
  token: string
  user: AuthUserDto
}

function toAuthUser(user: User, nome: string, profileId: string | null): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    nome,
    profileId,
  }
}

export async function registerUser(input: {
  email: string
  password: string
  nome: string
}): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim()

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (existing) {
    throw new AuthServiceError("EMAIL_IN_USE", "E-mail já cadastrado", 409)
  }

  const passwordHash = await hashPassword(input.password)

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email,
        passwordHash,
      })
      .returning()

    if (!user) {
      throw new Error("Falha ao criar usuário")
    }

    const [profile] = await tx
      .insert(profiles)
      .values({
        userId: user.id,
        nome: input.nome.trim(),
      })
      .returning()

    const session = await createSessionForUser(user.id)

    if (profile?.id) {
      await enqueueEmbeddingJob(profile.id)
    }

    return {
      token: session.token,
      user: toAuthUser(user, profile?.nome ?? input.nome, profile?.id ?? null),
    }
  })
}

export async function loginUser(input: {
  email: string
  password: string
}): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim()

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: { profile: true },
  })

  if (!user) {
    throw new AuthServiceError("INVALID_CREDENTIALS", "Credenciais inválidas", 401)
  }

  const valid = await verifyPassword({
    hash: user.passwordHash,
    password: input.password,
  })

  if (!valid) {
    throw new AuthServiceError("INVALID_CREDENTIALS", "Credenciais inválidas", 401)
  }

  const session = await createSessionForUser(user.id)

  return {
    token: session.token,
    user: toAuthUser(user, user.profile?.nome ?? "", user.profile?.id ?? null),
  }
}

export async function logoutByToken(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token))
}

export async function getUserBySessionToken(token: string): Promise<AuthUserDto | null> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.token, token),
    with: {
      user: {
        with: { profile: true },
      },
    },
  })

  if (!session?.user) return null

  if (session.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, session.id))
    return null
  }

  return toAuthUser(
    session.user,
    session.user.profile?.nome ?? "",
    session.user.profile?.id ?? null
  )
}

async function createSessionForUser(userId: string) {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
  const token = crypto.randomUUID() + crypto.randomUUID()

  const [session] = await db
    .insert(sessions)
    .values({
      id: crypto.randomUUID(),
      userId,
      token,
      expiresAt,
    })
    .returning()

  if (!session) {
    throw new Error("Falha ao criar sessão")
  }

  return session
}

/** Valida bearer via Better Auth (fallback compatível). */
export async function getSessionFromBearer(authorization: string | undefined) {
  if (!authorization?.startsWith("Bearer ")) return null
  const token = authorization.slice(7).trim()
  return getUserBySessionToken(token)
}

export class AuthServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = "AuthServiceError"
  }
}
