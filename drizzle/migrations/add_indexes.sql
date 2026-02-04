-- Add indexes for performance optimization
-- Created: 2026-02-03

-- Dashboard items indexes
CREATE INDEX IF NOT EXISTS idx_dashboard_section_product ON dashboardItems(section_type, product_category);
CREATE INDEX IF NOT EXISTS idx_dashboard_order ON dashboardItems(`order`);

-- Software items indexes
CREATE INDEX IF NOT EXISTS idx_software_section ON softwareItems(section_type);
CREATE INDEX IF NOT EXISTS idx_software_order ON softwareItems(`order`);

-- Systems items indexes
CREATE INDEX IF NOT EXISTS idx_systems_section ON systemsItems(section_type);
CREATE INDEX IF NOT EXISTS idx_systems_order ON systemsItems(`order`);

-- Decisions indexes
CREATE INDEX IF NOT EXISTS idx_decisions_week ON decisions(week);

-- Milestones indexes
CREATE INDEX IF NOT EXISTS idx_milestones_type_date ON milestones(milestone_type, milestone_date);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON milestones(milestone_date);
