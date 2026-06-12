import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createPgPool, resolveDatabaseUrl } from "./lib/pg-connection";

const databaseUrl = resolveDatabaseUrl(
  process.env.PRISMA_PUSH === "1" ? "session" : "pooler",
);

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
