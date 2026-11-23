ALTER TABLE `billing_batches` ADD `va_bs_number` text;--> statement-breakpoint
ALTER TABLE `billing_batches` ADD `va_subtotal` real;--> statement-breakpoint
ALTER TABLE `billing_batches` ADD `va_vat_amount` real;--> statement-breakpoint
ALTER TABLE `billing_batches` ADD `va_total` real;--> statement-breakpoint
ALTER TABLE `billing_batches` ADD `paid_at` integer;--> statement-breakpoint
ALTER TABLE `billing_batches` ADD `ar_number` text;--> statement-breakpoint
ALTER TABLE `billing_batches` ADD `va_ar_number` text;--> statement-breakpoint
ALTER TABLE `delivery_trips` ADD `va_rate` real;--> statement-breakpoint
ALTER TABLE `personal_client_customers` ADD `billing_mode` text DEFAULT 'commission' NOT NULL;--> statement-breakpoint
ALTER TABLE `personal_client_customers` ADD `next_ar_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `personal_client_customers` ADD `va_next_bs_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `personal_client_customers` ADD `va_next_ar_number` integer DEFAULT 1 NOT NULL;