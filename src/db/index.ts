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
type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | null = null;

// Next.js imports every API route module (which imports this file) during
// `next build`'s "Collect page data" step - sometimes several route modules
// at once, in parallel worker processes. On hosts like Railway, the
// persistent Volume isn't mounted yet during the build (only at runtime),
// and opening the *same* SQLite file from multiple processes at once for
// the first time can also throw SQLITE_BUSY due to lock contention.
//
// The fix is to never touch the filesystem at import time at all: the real
// connection is created lazily, the first time it's actually used - which
// only happens on a real request, in the single running server process,
// well after the Volume is mounted. Build-time import of this module (which
// only reads exports, never calls any of them) stays a total no-op.
function getDb(): DrizzleDb {
  if (!_db) {
    const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") || "dev.db";
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

// A transparent stand-in for the real drizzle client: every property access
// (db.select, db.query, db.insert, ...) is forwarded to the lazily-created
// real instance, so every existing `import { db } from "@/db"` call site
// keeps working unchanged.
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});
