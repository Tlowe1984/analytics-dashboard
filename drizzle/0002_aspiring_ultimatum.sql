CREATE TABLE `milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product` varchar(100) NOT NULL,
	`milestone_name` text NOT NULL,
	`milestone_date` timestamp NOT NULL,
	`milestone_type` enum('pdp_gates','sw_milestones','hw_dates') NOT NULL,
	`original_type` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `milestones_id` PRIMARY KEY(`id`)
);
