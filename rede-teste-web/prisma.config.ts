import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export default defineConfig({
  earlyAccess: true,
  schema: path.join(process.cwd(), "prisma", "schema.prisma"),
  migrate: {
    adapter: () => {
      const url =
        process.env.DATABASE_URL ??
        "postgresql://127.0.0.1:5432/portal?schema=public";
      const pool = new pg.Pool({ connectionString: url });
      return new PrismaPg(pool);
    },
  },
});
