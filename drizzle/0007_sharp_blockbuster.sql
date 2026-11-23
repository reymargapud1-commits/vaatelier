CREATE TABLE `staff_cash_advances` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_centavos` integer NOT NULL,
	`date_given` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`settled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `staff_payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`period_key` text NOT NULL,
	`period_label` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`days_present` integer NOT NULL,
	`daily_rate_centavos` integer NOT NULL,
	`gross_pay_centavos` integer NOT NULL,
	`cash_advance_deduction_centavos` integer DEFAULT 0 NOT NULL,
	`deduction_note` text DEFAULT '' NOT NULL,
	`net_pay_centavos` integer NOT NULL,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_payroll_user_period_unique` ON `staff_payroll_runs` (`user_id`,`period_key`);--> statement-breakpoint
CREATE TABLE `staff_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`position` text DEFAULT 'Virtual Assistant' NOT NULL,
	`daily_rate_centavos` integer NOT NULL,
	`start_date` integer NOT NULL,
	`service_agreement` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_profiles_user_id_unique` ON `staff_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `staff_time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`clock_in` integer NOT NULL,
	`clock_out` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
