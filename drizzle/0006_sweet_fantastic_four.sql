CREATE TABLE `billing_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`personal_client_id` text NOT NULL,
	`bs_number` text NOT NULL,
	`invoice_number` text NOT NULL,
	`batch_date` integer NOT NULL,
	`trip_count` integer NOT NULL,
	`subtotal` real NOT NULL,
	`vat_amount` real NOT NULL,
	`total_to_customer` real NOT NULL,
	`commission_total` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `personal_client_customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`personal_client_id`) REFERENCES `personal_clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `delivery_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`trip_date` integer NOT NULL,
	`plate_number` text NOT NULL,
	`driver_name` text NOT NULL,
	`helper1_name` text DEFAULT '' NOT NULL,
	`helper2_name` text DEFAULT '' NOT NULL,
	`route_from` text NOT NULL,
	`route_to` text NOT NULL,
	`gate_pass_number` text DEFAULT '' NOT NULL,
	`dr_si_number` text DEFAULT '' NOT NULL,
	`waybill_number` text DEFAULT '' NOT NULL,
	`remarks` text DEFAULT '' NOT NULL,
	`amount_rate` real NOT NULL,
	`billing_batch_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `personal_client_customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`billing_batch_id`) REFERENCES `billing_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `personal_client_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`personal_client_id` text NOT NULL,
	`name` text NOT NULL,
	`next_bs_number` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`personal_client_id`) REFERENCES `personal_clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `personal_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`industry` text DEFAULT '' NOT NULL,
	`business_address` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`tin` text DEFAULT '' NOT NULL,
	`commission_rate_per_trip` real DEFAULT 500 NOT NULL,
	`prepared_by_name` text DEFAULT '' NOT NULL,
	`prepared_by_title` text DEFAULT '' NOT NULL,
	`confirmed_by_name` text DEFAULT '' NOT NULL,
	`confirmed_by_title` text DEFAULT '' NOT NULL,
	`next_invoice_number` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
