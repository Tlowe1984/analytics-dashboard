CREATE TABLE `dashboard_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`section_type` enum('highlights','risks','upcoming') NOT NULL,
	`product_category` enum('ai_glasses','wrist','arg_ssg') NOT NULL,
	`content` text NOT NULL,
	`order` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dashboard_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_metadata` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` varchar(255) NOT NULL,
	`last_synced_at` timestamp NOT NULL,
	`sync_status` enum('success','failed','pending') NOT NULL DEFAULT 'pending',
	`error_message` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sync_metadata_id` PRIMARY KEY(`id`)
);
