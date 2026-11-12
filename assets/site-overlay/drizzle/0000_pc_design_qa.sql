CREATE TABLE `issue_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue_id` text NOT NULL,
	`revision` integer NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`changed_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `issue_history_issue_revision` ON `issue_history` (`issue_id`,`revision`);--> statement-breakpoint
CREATE TABLE `issue_state` (
	`issue_id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`handling_note` text DEFAULT '' NOT NULL,
	`repaired` integer DEFAULT 0 NOT NULL,
	`confirmed` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL,
	`edit_nonce` text DEFAULT '' NOT NULL
);
