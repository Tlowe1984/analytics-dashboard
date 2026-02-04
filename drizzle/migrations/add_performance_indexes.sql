-- Performance Optimization: Add indexes on frequently queried columns
-- This migration adds indexes to improve query performance across all tables

-- Dashboard Items: Frequently filtered by section_type and product_category
CREATE INDEX IF NOT EXISTS idx_dashboard_section_type ON dashboard_items(section_type);
CREATE INDEX IF NOT EXISTS idx_dashboard_product_category ON dashboard_items(product_category);
CREATE INDEX IF NOT EXISTS idx_dashboard_order ON dashboard_items(`order`);

-- Milestones: Frequently filtered by milestone_type and date range
CREATE INDEX IF NOT EXISTS idx_milestones_type ON milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON milestones(milestone_date);
CREATE INDEX IF NOT EXISTS idx_milestones_product ON milestones(product);
CREATE INDEX IF NOT EXISTS idx_milestones_type_date ON milestones(milestone_type, milestone_date);

-- Software Items: Frequently filtered by section_type
CREATE INDEX IF NOT EXISTS idx_software_section_type ON software_items(section_type);
CREATE INDEX IF NOT EXISTS idx_software_order ON software_items(`order`);

-- Systems Items: Frequently filtered by section_type
CREATE INDEX IF NOT EXISTS idx_systems_section_type ON systems_items(section_type);
CREATE INDEX IF NOT EXISTS idx_systems_order ON systems_items(`order`);

-- Decisions: Frequently ordered by week
CREATE INDEX IF NOT EXISTS idx_decisions_week ON decisions(week);

-- Upcoming Reviews: Frequently filtered and ordered by date
CREATE INDEX IF NOT EXISTS idx_upcoming_reviews_date ON upcoming_reviews(date);
CREATE INDEX IF NOT EXISTS idx_upcoming_reviews_type ON upcoming_reviews(review_type);
