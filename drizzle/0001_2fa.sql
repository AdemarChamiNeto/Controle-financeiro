CREATE TABLE `recovery_codes` (
	`id` char(36) NOT NULL DEFAULT (uuid()),
	`user_id` int NOT NULL,
	`code_hash` char(64) NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recovery_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `recovery_codes_user_code` UNIQUE(`user_id`,`code_hash`)
);
--> statement-breakpoint
CREATE TABLE `user_totp` (
	`user_id` int NOT NULL,
	`secret_encrypted` varchar(255) NOT NULL,
	`enabled_at` timestamp,
	`last_used_step` bigint,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_totp_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `recovery_codes` ADD CONSTRAINT `recovery_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_totp` ADD CONSTRAINT `user_totp_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;