import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

// For local dev and a single always-on server, a SQLite file works great
// and needs zero external setup. For a serverless production deployment
// (e.g. Vercel, where the filesystem isn't persistent across instances),
// swap this file's contents for the drizzle-orm/libsql client pointed at a
// free Turso database - the schema.ts file above is 100% compatible with
// both drivers since they're both the SQLite dialect. See README.
const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") || "dev.db";

// Next.js imports every API route module (which imports this file) during
// `next build`'s "Collect page data" step, on hosts like Railway where the
// persistent Volume isn't mounted yet during the build - only at runtime.
// Make sure the parent directory exists before opening the database so that
// build-time import doesn't crash; at actual runtime the Volume is mounted
// and this is a harmless no-op.
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
