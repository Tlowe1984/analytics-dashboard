import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Dashboard data items for the topline view
 * Stores individual bullets/items organized by section type and product category
 */
export const dashboardItems = mysqlTable("dashboard_items", {
  id: int("id").autoincrement().primaryKey(),
  sectionType: mysqlEnum("section_type", ["highlights", "risks", "upcoming"]).notNull(),
  productCategory: mysqlEnum("product_category", ["ai_glasses", "wrist", "arg_ssg"]).notNull(),
  content: text("content").notNull(),
  isNew: int("is_new").default(0).notNull(), // 1 if this is new information (blue text), 0 otherwise
  indentLevel: int("indent_level").default(0).notNull(), // Indentation level from Word numbering (0=flush left, 1+=indented)
  order: int("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DashboardItem = typeof dashboardItems.$inferSelect;
export type InsertDashboardItem = typeof dashboardItems.$inferInsert;

/**
 * Sync metadata for tracking Google Docs integration
 */
export const syncMetadata = mysqlTable("sync_metadata", {
  id: int("id").autoincrement().primaryKey(),
  documentId: varchar("document_id", { length: 255 }).notNull(),
  lastSyncedAt: timestamp("last_synced_at").notNull(),
  syncStatus: mysqlEnum("sync_status", ["success", "failed", "pending"]).default("pending").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SyncMetadata = typeof syncMetadata.$inferSelect;
export type InsertSyncMetadata = typeof syncMetadata.$inferInsert;

/**
 * Program milestones for upcoming dates section
 * Stores PDP gates, software milestones, and hardware dates
 */
export const milestones = mysqlTable("milestones", {
  id: int("id").autoincrement().primaryKey(),
  product: varchar("product", { length: 100 }).notNull(),
  milestoneName: text("milestone_name").notNull(),
  milestoneDate: timestamp("milestone_date").notNull(),
  milestoneType: mysqlEnum("milestone_type", ["pdp_gates", "sdp_milestones", "sw_milestones", "hw_dates", "release_milestones"]).notNull(),
  originalType: varchar("original_type", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Milestone = typeof milestones.$inferSelect;
export type InsertMilestone = typeof milestones.$inferInsert;

/**
 * Software review items for the Software (I+E, AI, Hearing) tab
 * Stores wins, product decisions, and hotspots
 */
export const softwareItems = mysqlTable("software_items", {
  id: int("id").autoincrement().primaryKey(),
  sectionType: mysqlEnum("section_type", ["wins", "exec_summary", "decisions"]).notNull(),
  content: text("content").notNull(),
  isNew: int("is_new").default(0).notNull(), // 1 if this is new information (blue text), 0 otherwise
  indentLevel: int("indent_level").default(0).notNull(), // Indentation level from Word numbering (0=flush left, 1+=indented)
  order: int("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SoftwareItem = typeof softwareItems.$inferSelect;
export type InsertSoftwareItem = typeof softwareItems.$inferInsert;

/**
 * Strategic decisions from Wearables Decision Canonical
 * Stores decisions with week, DRI, forum, status, and outcome
 */
export const decisions = mysqlTable("decisions", {
  id: int("id").autoincrement().primaryKey(),
  week: varchar("week", { length: 20 }).notNull(), // e.g., "W49 2025"
  dri: varchar("dri", { length: 255 }).notNull(),
  forum: varchar("forum", { length: 255 }),
  status: varchar("status", { length: 100 }),
  decisionOutcome: text("decision_outcome").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Decision = typeof decisions.$inferSelect;
export type InsertDecision = typeof decisions.$inferInsert;

/**
 * Systems review items for the Systems tab
 * Stores wins, exec summary, and help needed items
 */
export const systemsItems = mysqlTable("systems_items", {
  id: int("id").autoincrement().primaryKey(),
  sectionType: mysqlEnum("section_type", ["wins", "exec_summary", "help_needed"]).notNull(),
  content: text("content").notNull(),
  isNew: int("is_new").default(0).notNull(), // 1 if this is new information (blue text), 0 otherwise
  indentLevel: int("indent_level").default(0).notNull(), // Indentation level from Word numbering (0=flush left, 1+=indented)
  order: int("order").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SystemsItem = typeof systemsItems.$inferSelect;
export type InsertSystemsItem = typeof systemsItems.$inferInsert;
