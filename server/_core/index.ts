import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initSyncScheduler } from "../sync-scheduler";
import { invalidateDashboardCache } from "../query-cache";
import { runScheduledSync } from "../scheduledSync";
import { sdk } from "./sdk";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Health / wake-up endpoint — used by external ping services (e.g. cron-job.org)
  // to keep the sandbox alive before the 8:45 AM scheduled sync.
  // Returns 200 with uptime and scheduler status; safe to call unauthenticated.
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV ?? "unknown",
    });
  });

  // /api/scheduled/sync — Node.js-native sync endpoint for scheduled tasks.
  // Accepts POST requests authenticated via the Manus platform session cookie.
  // Allows any authenticated user (role == "user" or higher) so the platform-injected
  // scheduled-task cookie (which has role "user") can call it.
  app.post("/api/scheduled/sync", async (req, res) => {
    try {
      // Authenticate via session cookie
      let user: any = null;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Unauthorized — valid session cookie required" });
      }
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      console.log(`[ScheduledSync] Triggered by user ${user.openId} (role: ${user.role})`);
      // Run sync and wait for result (may take several minutes)
      const result = await runScheduledSync();
      // Clear query cache so frontend gets fresh data immediately
      invalidateDashboardCache();
      res.json(result);
    } catch (error: any) {
      console.error("[ScheduledSync] Error:", error);
      res.status(500).json({ error: error?.message || "Internal server error" });
    }
  });

  // Cache-clear endpoint — called by sync scripts after writing to DB so the
  // in-memory query cache is flushed and the frontend gets fresh data immediately.
  // Protected by a simple shared secret (SYNC_SECRET env var) to prevent abuse.
  app.post("/api/cache-clear", (req, res) => {
    const secret = process.env.SYNC_SECRET || "sync-secret-default";
    const provided = req.headers["x-sync-secret"] || req.body?.secret;
    if (provided !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    invalidateDashboardCache();
    res.json({ status: "ok", message: "Cache cleared", timestamp: new Date().toISOString() });
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // Initialize sync scheduler in both development and production.
    // The Node.js-native scheduledSync module uses GOOGLE_WORKSPACE_CLI_TOKEN
    // and Google Drive API v3 directly — no rclone or Python required.
    try {
      initSyncScheduler();
      console.log('[Server] Sync scheduler initialized');
    } catch (error) {
      console.error('[Server] Failed to initialize sync scheduler:', error);
    }
  });
}

startServer().catch(console.error);
