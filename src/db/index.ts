import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// For local dev and a single always-on server, a SQLite file works great
// and needs zero external setup. For a serverless production deployment
// (e.g. Vercel, where the filesystem isn't persistent across instances),
// swap this file's contents for the drizzle-orm/libsql client pointed at a
// free Turso database - the schema.ts file above is 100% compatible with
// both drivers since they're both the SQLite dialect. See README.
const sqlite = new Database(process.env.DATABASE_URL?.replace(/^file:/, "") || "dev.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
