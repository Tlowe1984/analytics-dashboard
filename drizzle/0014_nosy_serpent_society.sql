CREATE TABLE `upcoming_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`review_type` varchar(100) NOT NULL,
	`week` varchar(50) NOT NULL,
	`date` date NOT NULL,
	`topic` varchar(500) NOT NULL,
	`description` text,
	`owner` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `upcoming_reviews_id` PRIMARY KEY(`id`)
);
