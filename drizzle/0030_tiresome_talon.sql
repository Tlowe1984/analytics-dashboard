CREATE TABLE `ai_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`section_type` enum('wins','exec_summary','decisions') NOT NULL,
	`content` text NOT NULL,
	`is_new` int NOT NULL DEFAULT 0,
	`indent_level` int NOT NULL DEFAULT 0,
	`order` int NOT NULL DEFAULT 0,
	`dri` text,
	`forum` text,
	`status` text,
	`decision_doc` text,
	`decision_makers` text,
	`post` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `section_order_idx` ON `ai_items` (`section_type`,`order`);