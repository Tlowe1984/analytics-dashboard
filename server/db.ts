import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, dashboardItems, DashboardItem, InsertDashboardItem } from "../drizzle/schema";
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
