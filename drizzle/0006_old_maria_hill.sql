CREATE TABLE `decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`week` varchar(20) NOT NULL,
	`dri` varchar(255) NOT NULL,
	`forum` varchar(255),
	`status` varchar(100),
	`decision_outcome` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `decisions_id` PRIMARY KEY(`id`)
);
