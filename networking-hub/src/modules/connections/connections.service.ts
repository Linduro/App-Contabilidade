import { and, desc, eq, or } from "drizzle-orm"
import { db } from "../../db/index.js"
import { connections, type Connection } from "../../db/schema.js"
import {
  getProfileById,
  toPublicProfile,
  type PublicProfile,
} from "../profile/profile.service.js"
import type { ConnectionListQuery, UpdateConnectionInput } from "./connections.schema.js"

export type ConnectionDto = {
  id: string
  status: Connection["status"]
  similarityScore: number
  createdAt: Date
  direction: "sent" | "received"
  otherProfile: PublicProfile
}

function mapRow(
  row: Connection,
  myProfileId: string,
  otherProfile: PublicProfile
): ConnectionDto {
  const direction = row.profileAId === myProfileId ? "sent" : "received"
  return {
    id: row.id,
    status: row.status,
    similarityScore: row.similarityScore,
    createdAt: row.createdAt,
    direction,
    otherProfile,
  }
}

async function findExistingPair(
  profileAId: string,
  profileBId: string
): Promise<Connection | null> {
  const row = await db.query.connections.findFirst({
    where: or(
      and(
        eq(connections.profileAId, profileAId),
        eq(connections.profileBId, profileBId)
      ),
      and(
        eq(connections.profileAId, profileBId),
        eq(connections.profileBId, profileAId)
      )
    ),
  })
  return row ?? null
}

export async function createConnection(
  requesterProfileId: string,
  targetProfileId: string
): Promise<ConnectionDto> {
  if (requesterProfileId === targetProfileId) {
    throw new ConnectionsServiceError(
      "SAME_PROFILE",
      "Não é possível conectar consigo mesmo",
      400
    )
  }

  const target = await getProfileById(targetProfileId)
  if (!target) {
    throw new ConnectionsServiceError("PROFILE_NOT_FOUND", "Perfil não encontrado", 404)
  }

  const existing = await findExistingPair(requesterProfileId, targetProfileId)
  if (existing) {
    throw new ConnectionsServiceError(
      "CONNECTION_EXISTS",
      "Conexão já existe entre estes perfis",
      409
    )
  }

  const [created] = await db
    .insert(connections)
    .values({
      profileAId: requesterProfileId,
      profileBId: targetProfileId,
      status: "pendente",
      similarityScore: 0,
    })
    .returning()

  if (!created) {
    throw new Error("Falha ao criar conexão")
  }

  return mapRow(created, requesterProfileId, toPublicProfile(target))
}

export async function updateConnectionStatus(
  connectionId: string,
  recipientProfileId: string,
  input: UpdateConnectionInput
): Promise<ConnectionDto> {
  const row = await db.query.connections.findFirst({
    where: eq(connections.id, connectionId),
  })

  if (!row) {
    throw new ConnectionsServiceError("NOT_FOUND", "Conexão não encontrada", 404)
  }

  if (row.profileBId !== recipientProfileId) {
    throw new ConnectionsServiceError(
      "FORBIDDEN",
      "Apenas o destinatário pode aceitar ou ignorar",
      403
    )
  }

  if (row.status !== "pendente") {
    throw new ConnectionsServiceError(
      "INVALID_STATE",
      "Conexão já foi respondida",
      400
    )
  }

  const [updated] = await db
    .update(connections)
    .set({ status: input.status })
    .where(eq(connections.id, connectionId))
    .returning()

  if (!updated) {
    throw new Error("Falha ao atualizar conexão")
  }

  const requester = await getProfileById(updated.profileAId)
  if (!requester) {
    throw new ConnectionsServiceError("PROFILE_NOT_FOUND", "Perfil não encontrado", 404)
  }

  return mapRow(updated, recipientProfileId, toPublicProfile(requester))
}

async function hydrateConnection(
  row: Connection,
  myProfileId: string
): Promise<ConnectionDto | null> {
  const otherId =
    row.profileAId === myProfileId ? row.profileBId : row.profileAId
  const other = await getProfileById(otherId)
  if (!other) return null
  return mapRow(row, myProfileId, toPublicProfile(other))
}

export async function listConnections(
  myProfileId: string,
  query: ConnectionListQuery
): Promise<ConnectionDto[]> {
  const conditions = [
    or(
      eq(connections.profileAId, myProfileId),
      eq(connections.profileBId, myProfileId)
    ),
  ]
  if (query.status) {
    conditions.push(eq(connections.status, query.status))
  }

  const rows = await db
    .select()
    .from(connections)
    .where(and(...conditions))
    .orderBy(desc(connections.createdAt))

  const result: ConnectionDto[] = []
  for (const row of rows) {
    const dto = await hydrateConnection(row, myProfileId)
    if (dto) result.push(dto)
  }
  return result
}

export async function listPendingReceived(myProfileId: string): Promise<ConnectionDto[]> {
  const rows = await db
    .select()
    .from(connections)
    .where(
      and(eq(connections.profileBId, myProfileId), eq(connections.status, "pendente"))
    )
    .orderBy(desc(connections.createdAt))

  const result: ConnectionDto[] = []
  for (const row of rows) {
    const requester = await getProfileById(row.profileAId)
    if (!requester) continue
    result.push(mapRow(row, myProfileId, toPublicProfile(requester)))
  }
  return result
}

export class ConnectionsServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = "ConnectionsServiceError"
  }
}
