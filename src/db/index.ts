import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as unknown as {
  cultSql?: ReturnType<typeof postgres>;
};

const needsSsl =
  /sslmode=require/i.test(connectionString) ||
  /\.render\.com/i.test(connectionString) ||
  process.env.PGSSLMODE === "require";

const sql =
  globalForDb.cultSql ??
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    ...(needsSsl ? { ssl: "require" as const } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.cultSql = sql;
}

export const db = drizzle(sql, { schema });
export { sql };
