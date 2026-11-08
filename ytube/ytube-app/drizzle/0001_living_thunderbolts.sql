CREATE TABLE `auth_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`outcome` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_attempts_email_time_idx` ON `auth_attempts` (`email`,`created_at`);--> statement-breakpoint
CREATE TABLE `local_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_accounts_email_unique` ON `local_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `local_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `local_sessions_user_idx` ON `local_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `local_sessions_expiry_idx` ON `local_sessions` (`expires_at`);