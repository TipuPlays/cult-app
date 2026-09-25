import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy DB client so `next build` can collect page data without DATABASE_URL.
 * Runtime requests still require DATABASE_URL.
 */
const globalForDb = globalThis as unknown as {
  cultSql?: ReturnType<typeof postgres>;
  cultDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function getSql() {
  if (globalForDb.cultSql) return globalForDb.cultSql;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const needsSsl =
    /sslmode=require/i.test(connectionString) ||
    /\.render\.com/i.test(connectionString) ||
    process.env.PGSSLMODE === "require";

  const sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    ...(needsSsl ? { ssl: "require" as const } : {}),
  });

  globalForDb.cultSql = sql;
  return sql;
}

function getDb() {
  if (!globalForDb.cultDb) {
    globalForDb.cultDb = drizzle(getSql(), { schema });
  }
  return globalForDb.cultDb;
}

/** Proxy so existing `import { db } from "@/db"` keeps working */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export const sql = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, prop, receiver) {
    const real = getSql() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
  apply(_target, thisArg, args) {
    const real = getSql() as unknown as (...a: unknown[]) => unknown;
    return Reflect.apply(real, thisArg, args);
  },
});
