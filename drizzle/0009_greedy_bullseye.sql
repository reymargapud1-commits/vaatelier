PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_fleet_pms_records` (
	`id` text PRIMARY KEY NOT NULL,
	`vehicle_id` text NOT NULL,
	`plan_odo` text,
	`actual_odo` text,
	`mileage` integer,
	`pms_date` integer,
	`remarks` text DEFAULT '' NOT NULL,
	`person_in_charge` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`vehicle_id`) REFERENCES `fleet_vehicles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_fleet_pms_records`("id", "vehicle_id", "plan_odo", "actual_odo", "mileage", "pms_date", "remarks", "person_in_charge", "created_at") SELECT "id", "vehicle_id", "plan_odo", "actual_odo", "mileage", "pms_date", "remarks", "person_in_charge", "created_at" FROM `fleet_pms_records`;--> statement-breakpoint
DROP TABLE `fleet_pms_records`;--> statement-breakpoint
ALTER TABLE `__new_fleet_pms_records` RENAME TO `fleet_pms_records`;--> statement-breakpoint
PRAGMA foreign_keys=ON;