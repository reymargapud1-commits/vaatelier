import type { Config } from "drizzle-kit";

// drizzle-kit's CLI automatically loads variables from a .env file in the
// project root, so DATABASE_URL below will pick up whatever you set there.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, ""),
  },
} satisfies Config;
