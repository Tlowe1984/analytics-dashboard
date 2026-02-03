import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("dashboard operations", () => {
  beforeEach(async () => {
    // Clear all dashboard items before each test
    await db.clearAllDashboardItems();
  });

  it("should seed sample data successfully", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.seedSampleData();

    expect(result.success).toBe(true);
    expect(result.itemsCreated).toBe(27); // 3 sections × 3 products × 3 items each
  });

  it("should retrieve all dashboard items", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Seed data first
    await caller.dashboard.seedSampleData();

    // Get all items
    const items = await caller.dashboard.getAll();

    expect(items).toBeDefined();
    expect(items.length).toBe(27);
  });

  it("should retrieve items by section and category", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Seed data first
    await caller.dashboard.seedSampleData();

    // Get specific section
    const items = await caller.dashboard.getBySection({
      sectionType: "highlights",
      productCategory: "ai_glasses",
    });

    expect(items).toBeDefined();
    expect(items.length).toBe(3);
    expect(items[0]?.sectionType).toBe("highlights");
    expect(items[0]?.productCategory).toBe("ai_glasses");
  });

  it("should create a new dashboard item", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const newItem = {
      sectionType: "highlights" as const,
      productCategory: "wrist" as const,
      content: "Test highlight for wrist device",
      order: 1,
    };

    await caller.dashboard.create(newItem);

    const items = await caller.dashboard.getBySection({
      sectionType: "highlights",
      productCategory: "wrist",
    });

    expect(items.length).toBe(1);
    expect(items[0]?.content).toBe("Test highlight for wrist device");
  });

  it("should update an existing dashboard item", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create an item first
    await caller.dashboard.create({
      sectionType: "risks",
      productCategory: "arg_ssg",
      content: "Original content",
      order: 1,
    });

    const items = await caller.dashboard.getBySection({
      sectionType: "risks",
      productCategory: "arg_ssg",
    });

    const itemId = items[0]?.id;
    expect(itemId).toBeDefined();

    // Update the item
    await caller.dashboard.update({
      id: itemId!,
      content: "Updated content",
    });

    const updatedItems = await caller.dashboard.getBySection({
      sectionType: "risks",
      productCategory: "arg_ssg",
    });

    expect(updatedItems[0]?.content).toBe("Updated content");
  });

  it("should delete a dashboard item", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create an item first
    await caller.dashboard.create({
      sectionType: "upcoming",
      productCategory: "ai_glasses",
      content: "Item to be deleted",
      order: 1,
    });

    const items = await caller.dashboard.getBySection({
      sectionType: "upcoming",
      productCategory: "ai_glasses",
    });

    expect(items.length).toBe(1);
    const itemId = items[0]?.id;

    // Delete the item
    await caller.dashboard.delete({ id: itemId! });

    const remainingItems = await caller.dashboard.getBySection({
      sectionType: "upcoming",
      productCategory: "ai_glasses",
    });

    expect(remainingItems.length).toBe(0);
  });

  it("should handle multiple items in the same section", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create multiple items
    await caller.dashboard.create({
      sectionType: "highlights",
      productCategory: "wrist",
      content: "First highlight",
      order: 1,
    });

    await caller.dashboard.create({
      sectionType: "highlights",
      productCategory: "wrist",
      content: "Second highlight",
      order: 2,
    });

    await caller.dashboard.create({
      sectionType: "highlights",
      productCategory: "wrist",
      content: "Third highlight",
      order: 3,
    });

    const items = await caller.dashboard.getBySection({
      sectionType: "highlights",
      productCategory: "wrist",
    });

    expect(items.length).toBe(3);
    expect(items[0]?.order).toBe(1);
    expect(items[1]?.order).toBe(2);
    expect(items[2]?.order).toBe(3);
  });
});
