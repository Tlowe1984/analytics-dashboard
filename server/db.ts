import { eq, and, gte, lte, asc, desc, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, dashboardItems, milestones, InsertMilestone, DashboardItem, InsertDashboardItem, softwareItems, SoftwareItem, InsertSoftwareItem, decisions, Decision, InsertDecision, systemsItems, SystemsItem, InsertSystemsItem, hearingItems, HearingItem, InsertHearingItem, aiItems, AiItem, InsertAiItem, syncMetadata, upcomingReviews, UpcomingReview } from "../drizzle/schema";
import { ENV } from './_core/env';
import { cachedQuery } from "./query-cache";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL, {
        schema: { users, dashboardItems, milestones, softwareItems, decisions, systemsItems, hearingItems, aiItems, syncMetadata, upcomingReviews },
        mode: "default"
      });
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
  return cachedQuery('dashboard:all', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot get dashboard items: database not available");
      return [];
    }

    const result = await db.select().from(dashboardItems).orderBy(dashboardItems.order);
    return result;
  });
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

export async function getLastUpdatedTimestamp() {
  return cachedQuery('dashboard:lastUpdated', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot get last updated timestamp: database not available");
      return null;
    }

    const result = await db
      .select({ updatedAt: dashboardItems.updatedAt })
      .from(dashboardItems)
      .orderBy(desc(dashboardItems.updatedAt))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  });
}

// Milestone queries
export async function getUpcomingMilestones(milestoneType: "pdp_gates" | "sdp_milestones" | "sw_milestones" | "hw_dates" | "release_milestones", limit = 50) {
  return cachedQuery(`milestones:${milestoneType}:${limit}`, async () => {
    const db = await getDb();
    if (!db) return [];
  
  const now = new Date();
  
  // For PDP gates: show past 4 weeks and next 10 weeks
  if (milestoneType === "pdp_gates") {
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    
    const tenWeeksFromNow = new Date(now);
    tenWeeksFromNow.setDate(tenWeeksFromNow.getDate() + 70);
    
    const result = await db
      .select()
      .from(milestones)
      .where(and(
        eq(milestones.milestoneType, milestoneType),
        gte(milestones.milestoneDate, fourWeeksAgo),
        lte(milestones.milestoneDate, tenWeeksFromNow)
      ))
      .orderBy(asc(milestones.milestoneDate))
      .limit(limit);
    
      return result;
    }
    
    // For other types: show next 10 weeks
    const tenWeeksFromNow = new Date(now);
    tenWeeksFromNow.setDate(tenWeeksFromNow.getDate() + 70);
    
    const result = await db
      .select()
      .from(milestones)
      .where(and(
        eq(milestones.milestoneType, milestoneType),
        gte(milestones.milestoneDate, now),
        lte(milestones.milestoneDate, tenWeeksFromNow)
      ))
      .orderBy(asc(milestones.milestoneDate))
      .limit(limit);
    
    return result;
  });
}

export async function getAllMilestonesByType(milestoneType: "pdp_gates" | "sdp_milestones" | "sw_milestones" | "hw_dates") {
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
  const oneMonthFromNow = new Date(now);
  oneMonthFromNow.setDate(oneMonthFromNow.getDate() + 30);
  
  const result = await db
    .select()
    .from(milestones)
    .where(and(
      gte(milestones.milestoneDate, now),
      lte(milestones.milestoneDate, oneMonthFromNow),
      eq(milestones.milestoneType, 'release_milestones'),
      or(
        eq(milestones.product, 'In-Market Displayless'),
        eq(milestones.product, 'Hypernova')
      )
    ))
    .orderBy(asc(milestones.milestoneDate))
    .limit(limit);
  
  return result;
}

export async function getGTMMilestones(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  
  const now = new Date();
  const tenWeeksFromNow = new Date(now);
  tenWeeksFromNow.setDate(tenWeeksFromNow.getDate() + 70); // 10 weeks
  
  const result = await db
    .select()
    .from(milestones)
    .where(and(
      gte(milestones.milestoneDate, now),
      lte(milestones.milestoneDate, tenWeeksFromNow),
      eq(milestones.milestoneType, 'gtm_milestones')
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
export async function getSoftwareItemsWithWearablesTag(): Promise<SoftwareItem[]> {
  return cachedQuery('software:wearables-tag', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot get software items: database not available");
      return [];
    }

    const result = await db
      .select()
      .from(softwareItems)
      .where(eq(softwareItems.isWearablesTag, 1))
      .orderBy(softwareItems.order);

    return result;
  });
}

export async function getAllSoftwareItems(): Promise<SoftwareItem[]> {
  return cachedQuery('software:all', async () => {
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
  });
}

export async function getSoftwareItemsBySection(
  softwareCategory: "software_ie" | "software_ai" | "software_hearing",
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
    .where(and(
      eq(softwareItems.softwareCategory, softwareCategory),
      eq(softwareItems.sectionType, sectionType)
    ))
    .orderBy(softwareItems.order);

  return result;
}


// ============ Decisions Functions ============

/**
 * Get decisions for AI Executive Updates with new prioritization:
 * 1. Current week MZ decisions (highest priority)
 * 2. Current/previous week Wearables Review decisions
 * 3. Other current/previous week decisions
 * Returns up to 8 decisions total
 * Note: Summaries are generated in the router using LLM (≤25 words)
 */
export async function getRecentDecisionsForAI(limit = 13) {
  // NO CACHE - always fetch fresh data
  const db = await getDb();
  if (!db) return [];
  
  try {
    const { desc, gte } = await import("drizzle-orm");
    
    // Calculate current week number for classification
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const currentWeekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const currentWeekStr = `W${currentWeekNum} ${now.getFullYear()}`;
    const previousWeekStr = `W${currentWeekNum - 1} ${now.getFullYear()}`;
    
    // For database query, use a reasonable time window (last 2 months)
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(now.getMonth() - 2);
    
    // Get decisions from Decisions table (last 2 months, filter by week field later)
    const decisionsFromTable = await db
      .select()
      .from(decisions)
      .where(gte(decisions.updatedAt, twoMonthsAgo))
      .orderBy(desc(decisions.updatedAt));
    

    
    // Get Pillar decisions from Software items (last 2 months)
    const pillarDecisions = await db
      .select()
      .from(softwareItems)
      .where(and(
        eq(softwareItems.sectionType, "decisions"),
        eq(softwareItems.category, "Pillar"),
        gte(softwareItems.updatedAt, twoMonthsAgo)
      ))
      .orderBy(desc(softwareItems.updatedAt))
      .limit(limit * 2);
    
    // Combine and format with week classification based on week field
    const combined = [
      ...decisionsFromTable.map(item => ({
        type: 'decision' as const,
        forum: item.forum || '',
        outcome: item.decisionOutcome,
        date: item.updatedAt,
        week: item.week || '',
        isCurrentWeek: item.week === currentWeekStr,
        isPreviousWeek: item.week === previousWeekStr,
      })),
      ...pillarDecisions.map(item => ({
        type: 'pillar' as const,
        forum: item.forum || '',
        outcome: item.content,
        date: item.updatedAt,
        week: '',
        isCurrentWeek: false,
        isPreviousWeek: false,
      }))
    ];
    
    // Sort purely chronologically — most recent week first.
    // The decisions canonical doc is ordered newest-first, so items with the
    // same week share the same updatedAt; use the week string numerically as
    // a tiebreaker by extracting the week number.
    const parseWeekNum = (w: string) => {
      const m = w.match(/^W(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    };

    combined.sort((a, b) => {
      const wDiff = parseWeekNum(b.week) - parseWeekNum(a.week);
      if (wDiff !== 0) return wDiff;
      // Same week — preserve insertion order (earlier date = inserted first = newer in canonical doc)
      return a.date.getTime() - b.date.getTime();
    });

    return combined.slice(0, limit);
  } catch (error) {
    console.error("[Database] Error fetching recent decisions for AI:", error);
    return [];
  }
}

export async function getAllDecisions(): Promise<Decision[]> {
  return cachedQuery('decisions:all', async () => {
    const db = await getDb();
    if (!db) return [];
    
    try {
      // Sort by id ASC — decisions canonical doc is ordered newest-first,
      // so W10 rows get the lowest IDs (inserted first). asc(id) = W10 first.
      // Avoid string sort on week field ("W9" > "W10" lexicographically).
      const results = await db.select().from(decisions).orderBy(asc(decisions.id));
      return results;
    } catch (error) {
      console.error("[Database] Error fetching decisions:", error);
      return [];
    }
  });
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
  return cachedQuery('systems:all', async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(systemsItems).orderBy(asc(systemsItems.order));
  });
}

export async function getSystemsItemsBySection(sectionType: "wins" | "exec_summary" | "help_needed"): Promise<SystemsItem[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemsItems).where(eq(systemsItems.sectionType, sectionType)).orderBy(asc(systemsItems.order));
}


// ============ Upcoming Reviews Functions ============

/**
 * Get combined upcoming items for AI Executive Updates
 * Returns up to 6 items from current and next 2 weeks, combining PDP gates and upcoming decisions
 */
export async function getUpcomingItemsForAI(limit = 6) {
  return cachedQuery('ai:upcoming', async () => {
    const db = await getDb();
    if (!db) return [];
    
    try {
      const { upcomingReviews } = await import("../drizzle/schema.js");
      const { asc, and, eq, gte, lte } = await import("drizzle-orm");
      
      const now = new Date();
      const twoWeeksFromNow = new Date(now);
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      
      // Get PDP gates from current and next 2 weeks
      const pdpGates = await db
        .select()
        .from(milestones)
        .where(and(
          eq(milestones.milestoneType, "pdp_gates"),
          gte(milestones.milestoneDate, now),
          lte(milestones.milestoneDate, twoWeeksFromNow)
        ))
        .orderBy(asc(milestones.milestoneDate))
        .limit(limit);
      
      // Get upcoming reviews from next 2 weeks
      const reviews = await db
        .select()
        .from(upcomingReviews)
        .where(and(
          gte(upcomingReviews.date, now),
          lte(upcomingReviews.date, twoWeeksFromNow)
        ))
        .orderBy(asc(upcomingReviews.date))
        .limit(limit);
      
      // Combine and sort by date
      const combined = [
        ...pdpGates.map(item => ({
          type: 'pdp_gate' as const,
          date: item.milestoneDate,
          program: item.product,
          gateName: item.milestoneName,
          week: '', // Will be calculated in frontend
        })),
        ...reviews.map(item => ({
          type: 'upcoming_decision' as const,
          date: new Date(item.date),
          week: item.week,
          reviewType: item.reviewType,
          topic: item.topic,
        }))
      ];
      
      // Sort by date and take top items (up to limit)
      combined.sort((a, b) => a.date.getTime() - b.date.getTime());
      return combined.slice(0, limit);
    } catch (error) {
      console.error("[Database] Error fetching upcoming items for AI:", error);
      return [];
    }
  });
}

export async function getUpcomingReviews(): Promise<UpcomingReview[]> {
  return cachedQuery('reviews:upcoming', async () => {
    const db = await getDb();
    if (!db) return [];
    
    try {
      const { upcomingReviews } = await import("../drizzle/schema.js");
      const { asc } = await import("drizzle-orm");
      
      // Return all upcoming reviews sorted by date ASC (earliest first)
      const results = await db.select().from(upcomingReviews).orderBy(asc(upcomingReviews.date));
      return results;
    } catch (error) {
      console.error("[Database] Error fetching upcoming reviews:", error);
      return [];
    }
  });
}

export async function getAllMilestones() {
  return cachedQuery('milestones:all', async () => {
    const db = await getDb();
    if (!db) return [];
    
    const result = await db
      .select()
      .from(milestones)
      .orderBy(asc(milestones.milestoneDate));
    
    return result;
  });
}

/**
 * Get PDP milestones for this week and next week
 * Returns chronologically sorted PDP gates
 */
export async function getPDPMilestonesThisAndNextWeek() {
  return cachedQuery('pdp:this-next-week', async () => {
    const db = await getDb();
    if (!db) return [];
    
    try {
      const { asc, and, eq, gte, lte } = await import("drizzle-orm");
      
      const now = new Date();
      // Calculate end of next week (14 days from now)
      const endOfNextWeek = new Date(now);
      endOfNextWeek.setDate(endOfNextWeek.getDate() + 14);
      
      // Get PDP gates from current date to end of next week
      const pdpGates = await db
        .select()
        .from(milestones)
        .where(and(
          eq(milestones.milestoneType, "pdp_gates"),
          gte(milestones.milestoneDate, now),
          lte(milestones.milestoneDate, endOfNextWeek)
        ))
        .orderBy(asc(milestones.milestoneDate));
      
      return pdpGates;
    } catch (error) {
      console.error("[Database] Error fetching PDP milestones for this and next week:", error);
      return [];
    }
  });
}

// Hearing (Health) review queries
export async function getHearingItemsBySection(
  sectionType: "wins" | "exec_summary" | "decisions"
): Promise<HearingItem[]> {
  return cachedQuery(`hearing:${sectionType}`, async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot get hearing items: database not available");
      return [];
    }

    const { eq, asc } = await import("drizzle-orm");
    const result = await db
      .select()
      .from(hearingItems)
      .where(eq(hearingItems.sectionType, sectionType))
      .orderBy(asc(hearingItems.order));

    return result;
  });
}

export async function getAllHearingItems(): Promise<HearingItem[]> {
  return cachedQuery('hearing:all', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot get hearing items: database not available");
      return [];
    }

    const { asc } = await import("drizzle-orm");
    const result = await db
      .select()
      .from(hearingItems)
      .orderBy(asc(hearingItems.order));

    return result;
  });
}

// AI review queries
export async function getAiItemsBySection(
  sectionType: "wins" | "exec_summary" | "decisions"
): Promise<AiItem[]> {
  return cachedQuery(`ai:${sectionType}`, async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot get AI items: database not available");
      return [];
    }

    const { eq, asc } = await import("drizzle-orm");
    const result = await db
      .select()
      .from(aiItems)
      .where(eq(aiItems.sectionType, sectionType))
      .orderBy(asc(aiItems.order));

    return result;
  });
}

export async function getAllAiItems(): Promise<AiItem[]> {
  return cachedQuery('ai:all', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot get AI items: database not available");
      return [];
    }

    const { asc } = await import("drizzle-orm");
    const result = await db
      .select()
      .from(aiItems)
      .orderBy(asc(aiItems.order));

    return result;
  });
}

// Get wearables-tagged items from ALL data sources (Devices, Software, Systems, Hearing, AI)
export async function getWearablesTaggedItems(): Promise<Array<{ source: string; content: string; sectionType: string; isNew: number }>> {
  return cachedQuery('wearables:all', async () => {
    const db = await getDb();
    if (!db) {
      console.warn("[Database] Cannot get wearables-tagged items: database not available");
      return [];
    }

    const { eq, asc } = await import("drizzle-orm");
    
    // Get wearables-tagged items from Devices (dashboard_items)
    const devicesWearables = await db
      .select()
      .from(dashboardItems)
      .where(eq(dashboardItems.isWearablesTag, 1))
      .orderBy(asc(dashboardItems.order));
    
    // Get wearables-tagged items from Software (software_items)
    const softwareWearables = await db
      .select()
      .from(softwareItems)
      .where(eq(softwareItems.isWearablesTag, 1))
      .orderBy(asc(softwareItems.order));
    
    // Get wearables-tagged items from Systems
    const systemsWearables = await db
      .select()
      .from(systemsItems)
      .where(eq(systemsItems.isWearablesTag, 1))
      .orderBy(asc(systemsItems.order));
    
    // Get wearables-tagged items from Hearing
    const hearingWearables = await db
      .select()
      .from(hearingItems)
      .where(eq(hearingItems.isWearablesTag, 1))
      .orderBy(asc(hearingItems.order));
    
    // Get wearables-tagged items from AI
    const aiWearables = await db
      .select()
      .from(aiItems)
      .where(eq(aiItems.isWearablesTag, 1))
      .orderBy(asc(aiItems.order));
    
    // Normalize all items to a common format
    const normalizedItems = [
      ...devicesWearables.map(item => ({
        source: 'Devices',
        content: item.content,
        sectionType: item.sectionType,
        isNew: item.isNew
      })),
      ...softwareWearables.map(item => ({
        source: 'Software',
        content: item.content,
        sectionType: item.sectionType,
        isNew: item.isNew
      })),
      ...systemsWearables.map(item => ({
        source: 'Systems',
        content: item.content,
        sectionType: item.sectionType,
        isNew: item.isNew
      })),
      ...hearingWearables.map(item => ({
        source: 'Hearing',
        content: item.content,
        sectionType: item.sectionType,
        isNew: item.isNew
      })),
      ...aiWearables.map(item => ({
        source: 'AI',
        content: item.content,
        sectionType: item.sectionType,
        isNew: item.isNew
      }))
    ];
    
    return normalizedItems;
  });
}

// Get last updated timestamp for specific sections
export async function getDevicesLastUpdated() {
  return cachedQuery('dashboard:devices:lastUpdated', async () => {
    const db = await getDb();
    if (!db) return null;
    
    const result = await db
      .select({ updatedAt: dashboardItems.updatedAt })
      .from(dashboardItems)
      .orderBy(desc(dashboardItems.updatedAt))
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  });
}

export async function getSoftwareLastUpdated() {
  return cachedQuery('software:lastUpdated', async () => {
    const db = await getDb();
    if (!db) return null;
    
    const result = await db
      .select({ updatedAt: softwareItems.updatedAt })
      .from(softwareItems)
      .orderBy(desc(softwareItems.updatedAt))
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  });
}

export async function getSystemsLastUpdated() {
  return cachedQuery('systems:lastUpdated', async () => {
    const db = await getDb();
    if (!db) return null;
    
    const result = await db
      .select({ updatedAt: systemsItems.updatedAt })
      .from(systemsItems)
      .orderBy(desc(systemsItems.updatedAt))
      .limit(1);
    
    return result.length > 0 ? result[0] : null;
  });
}
