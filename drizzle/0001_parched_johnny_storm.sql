CREATE TABLE `store_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`item_key` text NOT NULL,
	`item_label` text NOT NULL,
	`amount_centavos` integer NOT NULL,
	`customer_note` text,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`checkout_session_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `store_orders_checkout_session_id_unique` ON `store_orders` (`checkout_session_id`);--> statement-breakpoint
ALTER TABLE `certificates` ADD `track` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `live_session_bookings` ADD `amount_centavos` integer DEFAULT 30000 NOT NULL;--> statement-breakpoint
ALTER TABLE `live_session_bookings` ADD `payment_status` text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `live_session_bookings` ADD `checkout_session_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `live_session_bookings_checkout_session_id_unique` ON `live_session_bookings` (`checkout_session_id`);--> statement-breakpoint
ALTER TABLE `payments` ADD `purpose` text DEFAULT 'enrollment' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `reference_id` text;