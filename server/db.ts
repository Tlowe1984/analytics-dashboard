import { eq, and, gte, lte, asc, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, dashboardItems, milestones, InsertMilestone, DashboardItem, InsertDashboardItem, softwareItems, SoftwareItem, InsertSoftwareItem, decisions, Decision, InsertDecision, systemsItems, SystemsItem, InsertSystemsItem } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Dashboard data queries
export async function getAllDashboardItems() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get dashboard items: database not available");
    return [];
  }

  const result = await db.select().from(dashboardItems).orderBy(dashboardItems.order);
  return result;
}

export async function getDashboardItemsBySection(
  sectionType: "highlights" | "risks" | "upcoming",
  productCategory: "ai_glasses" | "wrist" | "arg_ssg"
) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get dashboard items: database not available");
    return [];
  }

  const result = await db
    .select()
    .from(dashboardItems)
    .where(
      and(
        eq(dashboardItems.sectionType, sectionType),
        eq(dashboardItems.productCategory, productCategory)
      )
    )
    .orderBy(dashboardItems.order);

  return result;
}

export async function createDashboardItem(item: InsertDashboardItem) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create dashboard item: database not available");
    return null;
  }

  const result = await db.insert(dashboardItems).values(item);
  return result;
}

export async function updateDashboardItem(id: number, content: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update dashboard item: database not available");
    return null;
  }

  const result = await db
    .update(dashboardItems)
    .set({ content, updatedAt: new Date() })
    .where(eq(dashboardItems.id, id));

  return result;
}

export async function deleteDashboardItem(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete dashboard item: database not available");
    return null;
  }

  const result = await db.delete(dashboardItems).where(eq(dashboardItems.id, id));
  return result;
}

export async function clearAllDashboardItems() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot clear dashboard items: database not available");
    return null;
  }

  const result = await db.delete(dashboardItems);
  return result;
}

// Milestone queries
export async function getUpcomingMilestones(milestoneType: "pdp_gates" | "sw_milestones" | "hw_dates", limit = 10) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  
  // For PDP gates: show past 3 weeks and next month
  if (milestoneType === "pdp_gates") {
    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
    
    const oneMonthFromNow = new Date(now);
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    
    const result = await db
      .select()
      .from(milestones)
      .where(and(
        eq(milestones.milestoneType, milestoneType),
        gte(milestones.milestoneDate, threeWeeksAgo),
        lte(milestones.milestoneDate, oneMonthFromNow)
      ))
      .orderBy(asc(milestones.milestoneDate))
      .limit(limit);
    
    return result;
  }
  
  // For other types: show only upcoming
  const result = await db
    .select()
    .from(milestones)
    .where(and(
      eq(milestones.milestoneType, milestoneType),
      gte(milestones.milestoneDate, now)
    ))
    .orderBy(asc(milestones.milestoneDate))
    .limit(limit);
  
  return result;
}

export async function getAllMilestonesByType(milestoneType: "pdp_gates" | "sw_milestones" | "hw_dates") {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(milestones)
    .where(eq(milestones.milestoneType, milestoneType))
    .orderBy(asc(milestones.milestoneDate));
  
  return result;
}

export async function getReleaseDates(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const twelveMonthsFromNow = new Date(now);
  twelveMonthsFromNow.setMonth(twelveMonthsFromNow.getMonth() + 12);
  
  const result = await db
    .select()
    .from(milestones)
    .where(and(
      gte(milestones.milestoneDate, now),
      lte(milestones.milestoneDate, twelveMonthsFromNow),
      or(
        like(milestones.milestoneName, "%OSD%"),
        like(milestones.milestoneName, "%Launch%"),
        like(milestones.milestoneName, "%release%")
      )
    ))
    .orderBy(asc(milestones.milestoneDate))
    .limit(limit);
  
  return result;
}

export async function importMilestones(milestonesData: InsertMilestone[]) {
  const db = await getDb();
  if (!db) return { success: false, count: 0 };
  
  // Clear existing milestones
  await db.delete(milestones);
  
  // Insert new milestones in batches
  let count = 0;
  const batchSize = 100;
  for (let i = 0; i < milestonesData.length; i += batchSize) {
    const batch = milestonesData.slice(i, i + batchSize);
    await db.insert(milestones).values(batch);
    count += batch.length;
  }
  
  return { success: true, count };
}

// Software items queries
export async function getAllSoftwareItems(): Promise<SoftwareItem[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get software items: database not available");
    return [];
  }

  const result = await db
    .select()
    .from(softwareItems)
    .orderBy(softwareItems.order);

  return result;
}

export async function getSoftwareItemsBySection(
  sectionType: "wins" | "exec_summary" | "decisions"
): Promise<SoftwareItem[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get software items: database not available");
    return [];
  }

  const result = await db
    .select()
    .from(softwareItems)
    .where(eq(softwareItems.sectionType, sectionType))
    .orderBy(softwareItems.order);

  return result;
}


// ============ Decisions Functions ============

export async function getAllDecisions(): Promise<Decision[]> {
  const db = await getDb();
  if (!db) return [];
  
  try {
    // Return all decisions sorted by week (most recent first)
    const results = await db.select().from(decisions);
    return results;
  } catch (error) {
    console.error("[Database] Error fetching decisions:", error);
    return [];
  }
}

export async function clearDecisions(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.delete(decisions);
  } catch (error) {
    console.error("[Database] Error clearing decisions:", error);
  }
}

export async function insertDecision(decision: InsertDecision): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  try {
    await db.insert(decisions).values(decision);
  } catch (error) {
    console.error("[Database] Error inserting decision:", error);
  }
}


// ===== Systems Items =====

export async function getAllSystemsItems(): Promise<SystemsItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemsItems).orderBy(asc(systemsItems.order));
}

export async function getSystemsItemsBySection(sectionType: "wins" | "exec_summary" | "help_needed"): Promise<SystemsItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemsItems).where(eq(systemsItems.sectionType, sectionType)).orderBy(asc(systemsItems.order));
}
