/**
 * A handful of features predate training niches and were built assuming
 * there was exactly one course row: the 1-on-1 live coaching add-on (paid
 * and booked independently of the curriculum - see liveSessionBookings in
 * src/db/schema.ts, whose courseId is a NOT NULL foreign key into courses
 * left over from that era) and the enrollment checkout (which happens
 * BEFORE a student picks a niche on /dashboard/choose-niche, so there's no
 * "their" course yet to read a price/title from).
 *
 * Now that there can be several niches (= several courses), those features
 * are anchored to this one fixed course id rather than "whichever course
 * happens to come back first" from an unordered query - "va-foundations" is
 * guaranteed to always exist (it's the original course, kept in place by
 * the niches migration), so this never breaks even if more niches are
 * added later. Every niche's course row carries the same enrollment price
 * anyway (see TRAINING_PRICE_CENTAVOS in src/db/seed-logic.ts), so which
 * one is read for pricing purposes doesn't matter beyond "pick one, always
 * the same one."
 */
export const ANCHOR_COURSE_ID = "va-foundations";
