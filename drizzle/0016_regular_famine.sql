ALTER TABLE `milestones` MODIFY COLUMN `milestone_type` enum('pdp_gates','sdp_milestones','sw_milestones','hw_dates','release_milestones') NOT NULL;--> statement-breakpoint
ALTER TABLE `software_items` ADD `category` varchar(50);--> statement-breakpoint
ALTER TABLE `software_items` ADD `topic` text;--> statement-breakpoint
ALTER TABLE `software_items` ADD `dri` text;--> statement-breakpoint
ALTER TABLE `software_items` ADD `forum` text;--> statement-breakpoint
ALTER TABLE `software_items` ADD `status` text;--> statement-breakpoint
ALTER TABLE `software_items` ADD `decision_doc` text;--> statement-breakpoint
ALTER TABLE `software_items` ADD `decision_makers` text;--> statement-breakpoint
ALTER TABLE `software_items` ADD `decision_outcome` text;--> statement-breakpoint
ALTER TABLE `software_items` ADD `post` text;