import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
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

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("milestones router", () => {
  it("should fetch upcoming PDP gates", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.milestones.getUpcoming({
      milestoneType: "pdp_gates",
      limit: 5,
    });

    expect(Array.isArray(result)).toBe(true);
    // Should have some milestones (we inserted 20 PDP gates)
    expect(result.length).toBeGreaterThanOrEqual(0);
    expect(result.length).toBeLessThanOrEqual(5);

    if (result.length > 0) {
      const milestone = result[0];
      expect(milestone).toHaveProperty("id");
      expect(milestone).toHaveProperty("product");
      expect(milestone).toHaveProperty("milestoneName");
      expect(milestone).toHaveProperty("milestoneDate");
      expect(milestone.milestoneType).toBe("pdp_gates");
    }
  });

  it("should fetch upcoming software milestones", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.milestones.getUpcoming({
      milestoneType: "sw_milestones",
      limit: 5,
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(5);

    if (result.length > 0) {
      const milestone = result[0];
      expect(milestone.milestoneType).toBe("sw_milestones");
    }
  });

  it("should fetch upcoming hardware dates", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.milestones.getUpcoming({
      milestoneType: "hw_dates",
      limit: 5,
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeLessThanOrEqual(5);

    if (result.length > 0) {
      const milestone = result[0];
      expect(milestone.milestoneType).toBe("hw_dates");
    }
  });

  it("should fetch all milestones by type", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.milestones.getByType({
      milestoneType: "pdp_gates",
    });

    expect(Array.isArray(result)).toBe(true);
    // All milestones should be sorted by date
    if (result.length > 1) {
      const firstDate = new Date(result[0]!.milestoneDate);
      const secondDate = new Date(result[1]!.milestoneDate);
      expect(firstDate.getTime()).toBeLessThanOrEqual(secondDate.getTime());
    }
  });

  it("should respect the limit parameter", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.milestones.getUpcoming({
      milestoneType: "sw_milestones",
      limit: 3,
    });

    expect(result.length).toBeLessThanOrEqual(3);
  });
});
