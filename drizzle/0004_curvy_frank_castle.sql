CREATE TABLE `software_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`section_type` enum('wins','product_decisions','hotspots') NOT NULL,
	`content` text NOT NULL,
	`is_new` int NOT NULL DEFAULT 0,
	`order` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `software_items_id` PRIMARY KEY(`id`)
);
