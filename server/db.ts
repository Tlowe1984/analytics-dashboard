import { eq, and, gte, lte, asc, desc, or, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users, dashboardItems, milestones, InsertMilestone, DashboardItem, InsertDashboardItem, softwareItems, SoftwareItem, InsertSoftwareItem, decisions, Decision, InsertDecision, systemsItems, SystemsItem, InsertSystemsItem, hearingItems, HearingItem, InsertHearingItem, aiItems, AiItem, InsertAiItem, syncMetadata, upcomingReviews, UpcomingReview } from "../drizzle/schema";
import { ENV } from './_core/env';
import { cachedQuery } from "./query-cache";

let _db: ReturnType<typeof drizzle> | null = null;

// Strip ssl param from DATABASE_URL and pass ssl as a proper object to mysql2.
function stripSslFromUrl(url: string): string {
  return url.replace(/[?&]ssl=[^&]*/g, (match, offset, str) => {
    // If this was the only query param (starts with ?), keep the ? but remove the param
    // If there are more params after, replace with nothing or &
    return '';
  }).replace(/\?$/, '').replace(/\?&/, '?');
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Strip the ssl param from the URL and pass ssl as an object instead
      const dbUrl = process.env.DATABASE_URL.replace(/[?&]ssl=[^&]*/g, '').replace(/\?$/, '').replace(/\?&/, '?');
      const pool = mysql.createPool({
        uri: dbUrl,
        ssl: { rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 10,
      });
      _db = drizzle(pool, {
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
 * Get decisions for AI Executive Updates top tile with strict rules:
 * - Only last 2 weeks (current week + previous week)
 * - Exclude DRI = Timothy Lowe
 * - Exclude outcomes containing 'cannot be displayed'
 * - Prioritize: MZ forum first, then Wearable Review, then others
 * - Max 8 decisions total
 * Note: Summaries are generated in the router using LLM (≤60 words)
 */
export async function getRecentDecisionsForAI(limit = 8) {
  // NO CACHE - always fetch fresh data
  const db = await getDb();
  if (!db) return [];
  
  try {
    // Cross-year-safe week number parser: W3 2026 > W50 2025
    const weekToNumber = (w: string): number => {
      const m = w.match(/^W(\d+)\s+(\d{4})/);
      if (!m) return 0;
      const weekNum = parseInt(m[1], 10);
      const year = parseInt(m[2], 10);
      return year * 100 + weekNum;
    };

    // Calculate current and previous week strings (cross-year safe)
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const currentWeekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const currentWeekStr = `W${currentWeekNum} ${now.getFullYear()}`;
    // Handle year boundary: if currentWeekNum is 1, previous week is W52 of last year
    const prevWeekNum = currentWeekNum > 1 ? currentWeekNum - 1 : 52;
    const prevWeekYear = currentWeekNum > 1 ? now.getFullYear() : now.getFullYear() - 1;
    const previousWeekStr = `W${prevWeekNum} ${prevWeekYear}`;
    
    const allowedWeeks = new Set([currentWeekStr, previousWeekStr]);

    // Fetch all decisions (no date filter — filter by week string instead)
    const allDecisions = await db
      .select()
      .from(decisions)
      .orderBy(desc(decisions.id));
    
    // Apply all filters:
    // 1. Only last 2 weeks
    // 2. Exclude Timothy Lowe as DRI
    // 3. Exclude 'cannot be displayed' in outcome
    const filtered = allDecisions.filter(item => {
      const week = item.week || '';
      const dri = item.dri || '';
      const outcome = item.decisionOutcome || '';
      
      if (!allowedWeeks.has(week)) return false;
      if (dri.toLowerCase().includes('timothy lowe')) return false;
      if (outcome.toLowerCase().includes('cannot be displayed')) return false;
      return true;
    });

    // Sort: MZ forum first, then Wearable Review, then others; within tier sort by week desc
    const forumPriority = (forum: string): number => {
      const f = forum.toLowerCase();
      if (f.includes('mz')) return 0;
      if (f.includes('wearable')) return 1;
      return 2;
    };

    filtered.sort((a, b) => {
      // Primary: most recent week first
      const wDiff = weekToNumber(b.week || '') - weekToNumber(a.week || '');
      if (wDiff !== 0) return wDiff;
      // Secondary: MZ > Wearable > Other
      const pDiff = forumPriority(a.forum || '') - forumPriority(b.forum || '');
      if (pDiff !== 0) return pDiff;
      // Tertiary: preserve insertion order
      return a.id - b.id;
    });

    return filtered.slice(0, limit).map(item => ({
      type: 'decision' as const,
      forum: item.forum || '',
      outcome: item.decisionOutcome,
      date: item.updatedAt,
      week: item.week || '',
      isCurrentWeek: item.week === currentWeekStr,
      isPreviousWeek: item.week === previousWeekStr,
    }));
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
      // Fetch all decisions and sort using cross-year-safe weekToNumber.
      // Cannot rely on desc(id) because the canonical doc is ordered newest-first,
      // so re-inserts give highest IDs to the oldest weeks.
      const results = await db.select().from(decisions);
      const weekToNumber = (w: string): number => {
        const m = w.match(/^W(\d+)\s+(\d{4})/);
        if (!m) return 0;
        return parseInt(m[2], 10) * 100 + parseInt(m[1], 10);
      };
      results.sort((a, b) => {
        const wDiff = weekToNumber(b.week || '') - weekToNumber(a.week || '');
        if (wDiff !== 0) return wDiff;
        // Same week — preserve canonical doc order (lower id = inserted first = appears first in doc)
        return a.id - b.id;
      });
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

/** Deduplicate systems items by sectionType + plain-text content, keeping the first occurrence (lowest order).
 * Strips markdown bold markers (**) and normalizes whitespace so formatting variants of the
 * same bullet (e.g. "**Arch: **text" vs "**Arch:** text") are treated as identical.
 */
function dedupeSystemsItems(items: SystemsItem[]): SystemsItem[] {
  const seen = new Set<string>();
  const toPlain = (s: string) => s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return items.filter(item => {
    const key = `${item.sectionType}::${toPlain(item.content)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getAllSystemsItems(): Promise<SystemsItem[]> {
  return cachedQuery('systems:all', async () => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(systemsItems).orderBy(asc(systemsItems.order));
    return dedupeSystemsItems(rows);
  });
}

export async function getSystemsItemsBySection(sectionType: "wins" | "exec_summary" | "help_needed"): Promise<SystemsItem[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(systemsItems).where(eq(systemsItems.sectionType, sectionType)).orderBy(asc(systemsItems.order));
  return dedupeSystemsItems(rows);
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
      // Use start of today (midnight UTC) so items scheduled for today are included
      const startOfToday = new Date(now);
      startOfToday.setUTCHours(0, 0, 0, 0);
      const twoWeeksFromNow = new Date(startOfToday);
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      
      // Get PDP gates from current and next 2 weeks
      const pdpGates = await db
        .select()
        .from(milestones)
        .where(and(
          eq(milestones.milestoneType, "pdp_gates"),
          gte(milestones.milestoneDate, startOfToday),
          lte(milestones.milestoneDate, twoWeeksFromNow)
        ))
        .orderBy(asc(milestones.milestoneDate))
        .limit(limit);
      
      // Get upcoming reviews from next 2 weeks (use higher limit to avoid crowding out by PDP gates)
      const reviews = await db
        .select()
        .from(upcomingReviews)
        .where(and(
          gte(upcomingReviews.date, startOfToday),
          lte(upcomingReviews.date, twoWeeksFromNow)
        ))
        .orderBy(asc(upcomingReviews.date))
        .limit(limit * 3);
      
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
      // Return up to limit*4 items so all reviews show (top tile handles display truncation)
      return combined.slice(0, limit * 4);
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
          gte(milestones.milestoneDate, startOfToday),
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
