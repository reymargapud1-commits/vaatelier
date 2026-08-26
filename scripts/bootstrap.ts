import "dotenv/config";
import { runMigrations } from "../src/db/migrate";
import { seedDatabase } from "../src/db/seed-logic";

/**
 * Runs automatically before every `npm start` (see package.json), so a
 * fresh deployment (e.g. on Railway/Render) needs zero manual database
 * commands: it applies any pending schema migrations, then seeds the
 * course/quiz content and admin account every time it boots.
 * Safe to run on every boot - both steps are idempotent (upserts by ID),
 * which is also what makes editing content/*.json or changing
 * SEED_ADMIN_PASSWORD and redeploying actually take effect.
 */
async function bootstrap() {
  console.log("[bootstrap] Applying database migrations...");
  runMigrations();

  // seedDatabase() is fully idempotent (upserts by ID, and updates the admin
  // account's password hash every time), so it's safe - and necessary - to
  // run on every boot. This is what makes editing content/*.json or changing
  // SEED_ADMIN_PASSWORD in your host's environment variables and redeploying
  // actually take effect, instead of only applying on the very first boot.
  console.log("[bootstrap] Seeding course content and admin account...");
  await seedDatabase();

  console.log("[bootstrap] Ready.");
}

bootstrap()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[bootstrap] Failed:", err);
    process.exit(1);
  });
