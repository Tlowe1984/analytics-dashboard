ALTER TABLE `milestones` MODIFY COLUMN `milestone_type` enum('pdp_gates','sdp_milestones','sw_milestones','hw_milestones','release_milestones') NOT NULL;--> statement-breakpoint
CREATE INDEX `section_product_idx` ON `dashboard_items` (`section_type`,`product_category`);--> statement-breakpoint
CREATE INDEX `order_idx` ON `dashboard_items` (`order`);--> statement-breakpoint
CREATE INDEX `type_date_idx` ON `milestones` (`milestone_type`,`milestone_date`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `milestones` (`milestone_date`);--> statement-breakpoint
CREATE INDEX `section_order_idx` ON `software_items` (`section_type`,`order`);--> statement-breakpoint
CREATE INDEX `section_order_idx` ON `systems_items` (`section_type`,`order`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `upcoming_reviews` (`date`);--> statement-breakpoint
CREATE INDEX `review_type_idx` ON `upcoming_reviews` (`review_type`);