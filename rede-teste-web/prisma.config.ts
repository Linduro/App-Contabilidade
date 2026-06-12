import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createPgPool } from "./lib/pg-connection";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://127.0.0.1:5432/portal?schema=public";

export default defineConfig({
  earlyAccess: true,
  schema: path.join(process.cwd(), "prisma", "schema.prisma"),
  datasource: {
    url: databaseUrl,
  },
  migrate: {
    adapter: () => new PrismaPg(createPgPool(databaseUrl)),
  },
});
