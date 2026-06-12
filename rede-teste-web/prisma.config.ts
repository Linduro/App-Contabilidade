import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

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
    adapter: () => {
      const pool = new pg.Pool({ connectionString: databaseUrl });
      return new PrismaPg(pool);
    },
  },
});
