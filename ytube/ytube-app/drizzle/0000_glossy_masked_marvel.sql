CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`answer` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`handle` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`banner_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_handle_unique` ON `channels` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `channels_owner_unique` ON `channels` (`owner_id`);--> statement-breakpoint
CREATE TABLE `comment_reactions` (
	`user_id` text NOT NULL,
	`comment_id` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`user_id`, `comment_id`)
);
--> statement-breakpoint
CREATE TABLE `comment_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`reporter_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_report_once_idx` ON `comment_reports` (`comment_id`,`reporter_id`);--> statement-breakpoint
CREATE TABLE `comment_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`body` text NOT NULL,
	`language` text NOT NULL,
	`version` integer NOT NULL,
	`edited_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `revisions_comment_idx` ON `comment_revisions` (`comment_id`,`version`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`video_id` text NOT NULL,
	`parent_id` text,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`normalized_body` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`report_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_video_created_idx` ON `comments` (`video_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_parent_idx` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `comments_author_duplicate_idx` ON `comments` (`author_id`,`normalized_body`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_report_idx` ON `comments` (`report_count`,`created_at`);--> statement-breakpoint
CREATE TABLE `moderation_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text,
	`actor_id` text,
	`action` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `moderation_comment_idx` ON `moderation_actions` (`comment_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `playlist_items` (
	`playlist_id` text NOT NULL,
	`video_id` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`playlist_id`, `video_id`)
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `playlists_owner_idx` ON `playlists` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `post_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`outcome` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attempts_user_time_idx` ON `post_attempts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `channel_id`)
);
--> statement-breakpoint
CREATE INDEX `subscriptions_channel_idx` ON `subscriptions` (`channel_id`);--> statement-breakpoint
CREATE TABLE `translations` (
	`comment_id` text NOT NULL,
	`version` integer NOT NULL,
	`language` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`comment_id`, `version`, `language`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`location` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);--> statement-breakpoint
CREATE TABLE `video_reactions` (
	`user_id` text NOT NULL,
	`video_id` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`user_id`, `video_id`)
);
--> statement-breakpoint
CREATE INDEX `video_reactions_video_idx` ON `video_reactions` (`video_id`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`media_key` text,
	`thumbnail_key` text,
	`sample_url` text,
	`sample_thumb` integer,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `videos_channel_created_idx` ON `videos` (`channel_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `videos_status_created_idx` ON `videos` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `videos_category_idx` ON `videos` (`category`);--> statement-breakpoint
CREATE TABLE `watch_history` (
	`user_id` text NOT NULL,
	`video_id` text NOT NULL,
	`progress_seconds` integer DEFAULT 0 NOT NULL,
	`watched_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `video_id`)
);
--> statement-breakpoint
CREATE INDEX `watch_history_user_time_idx` ON `watch_history` (`user_id`,`watched_at`);--> statement-breakpoint
CREATE TABLE `watch_later` (
	`user_id` text NOT NULL,
	`video_id` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `video_id`)
);
