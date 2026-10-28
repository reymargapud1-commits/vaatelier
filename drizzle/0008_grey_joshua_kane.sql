CREATE TABLE `fleet_pms_records` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`plan_odo` integer,
	`actual_odo` integer,
	`mileage` integer,
	`pms_date` integer,
	`remarks` text DEFAULT '' NOT NULL,
	`person_in_charge` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `fleet_vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fleet_vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`personal_client_id` text NOT NULL,
	`plate_number` text NOT NULL,
	`truck_name` text DEFAULT '' NOT NULL,
	`date_acquired` integer,
	`registration_date` integer,
	`location` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`personal_client_id`) REFERENCES `personal_clients`(`id`) ON UPDATE no action ON DELETE no action
);
