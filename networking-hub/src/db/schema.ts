import { relations, sql } from "drizzle-orm"
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core"

export const connectionStatusEnum = pgEnum("connection_status", [
  "sugerida",
  "aceita",
  "ignorada",
])

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

/** Sessões Better Auth */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    turma: text("turma"),
    cargoAtual: text("cargo_atual"),
    empresa: text("empresa"),
    areaAtuacao: text("area_atuacao").array().notNull().default(sql`'{}'::text[]`),
    expertises: text("expertises").array().notNull().default(sql`'{}'::text[]`),
    oQueOfeco: text("o_que_ofeco"),
    oQueBusco: text("o_que_busco"),
    linkedinUrl: text("linkedin_url"),
    disponivelMentoria: boolean("disponivel_mentoria").notNull().default(false),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingGeradoEm: timestamp("embedding_gerado_em", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("profiles_user_id_idx").on(table.userId)]
)

export const expertisesCatalog = pgTable("expertises_catalog", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull().unique(),
  categoria: text("categoria"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileAId: uuid("profile_a_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    profileBId: uuid("profile_b_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: connectionStatusEnum("status").notNull().default("sugerida"),
    similarityScore: real("similarity_score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("connections_pair_unique").on(table.profileAId, table.profileBId),
  ]
)

export const matchResults = pgTable(
  "match_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    matchedProfileId: uuid("matched_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    breakdown: jsonb("breakdown")
      .$type<{
        semantic: number
        tagsShared: number
        complementarity: number
      }>()
      .notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("match_results_pair_unique").on(table.profileId, table.matchedProfileId),
  ]
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  sessions: many(sessions),
}))

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
  matchResults: many(matchResults),
}))

export type User = typeof users.$inferSelect
export type Profile = typeof profiles.$inferSelect
export type Session = typeof sessions.$inferSelect
export type ExpertiseCatalog = typeof expertisesCatalog.$inferSelect
export type Connection = typeof connections.$inferSelect
export type MatchResult = typeof matchResults.$inferSelect
