ALTER TABLE `courses` ADD `short_description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `icon` text DEFAULT '💼' NOT NULL;--> statement-breakpoint
ALTER TABLE `courses` ADD `is_published` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `course_id` text REFERENCES courses(id);--> statement-breakpoint
-- One-time backfill: every student who was already enrolled before training
-- niches existed gets attached to the original course (kept as the
-- "General & Admin VA" niche, id 'va-foundations') so they were never
-- interrupted with a "choose your niche" screen. This runs exactly once,
-- ever, as part of this migration - it does NOT re-run on later boots, so
-- it never wrongly grabs a real new enrollee who is legitimately still
-- waiting to pick a niche.
UPDATE `users` SET `course_id` = 'va-foundations' WHERE `is_paid` = 1 AND `course_id` IS NULL;