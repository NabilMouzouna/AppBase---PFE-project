PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_jwks` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text,
	`public_key` text NOT NULL,
	`private_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_jwks`("id", "key", "public_key", "private_key", "created_at", "updated_at") SELECT "id", "key", "public_key", "private_key", "created_at", "updated_at" FROM `jwks`;--> statement-breakpoint
DROP TABLE `jwks`;--> statement-breakpoint
ALTER TABLE `__new_jwks` RENAME TO `jwks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;