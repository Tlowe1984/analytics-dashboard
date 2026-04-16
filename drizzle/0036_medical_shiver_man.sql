CREATE TABLE `pdp_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pdp_gate` varchar(500) NOT NULL,
	`status_plan` varchar(500),
	`critical_topics` text,
	`link_text` varchar(500),
	`link_url` varchar(1000),
	`sort_order` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pdp_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pdp_sort_order_idx` ON `pdp_status` (`sort_order`);