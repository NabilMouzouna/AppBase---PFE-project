import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../migrations"),
  });
  return db;
}

export type AppDb = ReturnType<typeof createDb>;
