import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
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

  return { ctx };
}

describe("sync operations", () => {
  it("should have syncAll procedure available", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Just verify the procedure exists and can be called
    // We won't actually run the sync in tests since it requires external files
    expect(caller.sync.syncAll).toBeDefined();
    expect(typeof caller.sync.syncAll).toBe("function");
  });

  it("should have syncExecSummary procedure available", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    expect(caller.sync.syncExecSummary).toBeDefined();
    expect(typeof caller.sync.syncExecSummary).toBe("function");
  });

  it("should have syncMilestones procedure available", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    expect(caller.sync.syncMilestones).toBeDefined();
    expect(typeof caller.sync.syncMilestones).toBe("function");
  });

  it("should require authentication for sync procedures", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);

    // Sync procedures should be protected and throw when user is not authenticated
    await expect(caller.sync.syncAll()).rejects.toThrow();
  });
});
