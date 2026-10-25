/**
 * The 1-on-1 coaching add-on and its bookings are stored against a single
 * fixed course row, even though a student may not have picked a niche yet
 * (coaching is open to anyone with an account, enrolled or not - see
 * README "Live training session booking"). This is that anchor course:
 * "General & Admin VA" (va-foundations), the original/default niche, which
 * is always seeded first (see src/db/seed-logic.ts + content/niches.json).
 */
export const ANCHOR_COURSE_ID = "va-foundations";
