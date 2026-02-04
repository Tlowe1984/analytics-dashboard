/**
 * Sync Monitoring Module
 * Provides health checks and monitoring endpoints for the sync system
 */

import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getLastSyncStatus, triggerManualSync } from "./sync-scheduler-safeguarded";
import * as db from "./db";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const syncMonitoringRouter = router({
  /**
   * Get sync health status
   */
  getHealth: publicProcedure.query(async () => {
    const lastSync = getLastSyncStatus();
    
    // Get data counts from database
    const [
      dashboardCount,
      softwareCount,
      systemsCount,
      decisionsCount,
      reviewsCount,
      milestonesCount,
    ] = await Promise.all([
      db.getAllDashboardItems().then((items) => items.length),
      db.getAllSoftwareItems().then((items) => items.length),
      db.getAllSystemsItems().then((items) => items.length),
      db.getAllDecisions().then((items) => items.length),
      db.getUpcomingReviews().then((items) => items.length),
      db.getAllMilestones().then((items) => items.length),
    ]);

    const totalItems = dashboardCount + softwareCount + systemsCount + decisionsCount + reviewsCount + milestonesCount;

    // Calculate health score
    let healthScore = 100;
    const issues: string[] = [];

    // Check 1: Last sync time
    if (!lastSync) {
      healthScore -= 30;
      issues.push("No sync has been run yet");
    } else {
      const hoursSinceSync = (Date.now() - lastSync.timestamp.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceSync > 36) {
        healthScore -= 30;
        issues.push(`No sync in ${Math.round(hoursSinceSync)} hours`);
      } else if (hoursSinceSync > 26) {
        healthScore -= 10;
        issues.push(`Sync overdue (${Math.round(hoursSinceSync)} hours ago)`);
      }

      // Check 2: Last sync success
      if (!lastSync.success) {
        healthScore -= 40;
        issues.push(`Last sync failed: ${lastSync.error}`);
      }

      // Check 3: Sync duration
      if (lastSync.duration > 120) {
        healthScore -= 10;
        issues.push(`Slow sync (${lastSync.duration}s, expected <90s)`);
      }
    }

    // Check 4: Data volume
    if (totalItems < 50) {
      healthScore -= 20;
      issues.push(`Low data volume (${totalItems} items, expected >50)`);
    }

    // Determine status
    let status: "healthy" | "warning" | "critical";
    if (healthScore >= 90) {
      status = "healthy";
    } else if (healthScore >= 60) {
      status = "warning";
    } else {
      status = "critical";
    }

    return {
      status,
      healthScore,
      lastSync: lastSync
        ? {
            timestamp: lastSync.timestamp.toISOString(),
            success: lastSync.success,
            duration: lastSync.duration,
            error: lastSync.error,
          }
        : null,
      dataCounts: {
        dashboard: dashboardCount,
        software: softwareCount,
        systems: systemsCount,
        decisions: decisionsCount,
        reviews: reviewsCount,
        milestones: milestonesCount,
        total: totalItems,
      },
      issues,
    };
  }),

  /**
   * Get detailed sync statistics
   */
  getStatistics: publicProcedure.query(async () => {
    // Parse sync log for statistics
    try {
      const { stdout } = await execAsync(
        "tail -1000 /home/ubuntu/analytics-dashboard/.manus-logs/sync.log | grep -E '\\[SUCCESS\\]|\\[ERROR\\]|\\[WARNING\\]' | tail -50"
      );

      const lines = stdout.trim().split("\n").filter((line) => line);
      
      const successCount = lines.filter((line) => line.includes("[SUCCESS]")).length;
      const errorCount = lines.filter((line) => line.includes("[ERROR]")).length;
      const warningCount = lines.filter((line) => line.includes("[WARNING]")).length;

      return {
        recentEvents: lines.length,
        successCount,
        errorCount,
        warningCount,
        successRate: lines.length > 0 ? Math.round((successCount / lines.length) * 100) : 0,
      };
    } catch (error) {
      return {
        recentEvents: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        successRate: 0,
      };
    }
  }),

  /**
   * Get recent sync log entries
   */
  getRecentLogs: publicProcedure
    .input(z.object({ lines: z.number().min(10).max(500).default(50) }))
    .query(async ({ input }) => {
      try {
        const { stdout } = await execAsync(
          `tail -${input.lines} /home/ubuntu/analytics-dashboard/.manus-logs/sync.log`
        );

        const logs = stdout
          .trim()
          .split("\n")
          .filter((line) => line)
          .map((line) => {
            // Parse log line: [LEVEL] timestamp message
            const match = line.match(/\[(INFO|SUCCESS|WARNING|ERROR)\] ([\d-]+ [\d:]+) (.+)/);
            
            if (match) {
              return {
                level: match[1].toLowerCase() as "info" | "success" | "warning" | "error",
                timestamp: match[2],
                message: match[3],
              };
            }
            
            return {
              level: "info" as const,
              timestamp: "",
              message: line,
            };
          });

        return { logs };
      } catch (error) {
        return { logs: [] };
      }
    }),

  /**
   * Manually trigger a sync (admin only)
   */
  triggerSync: publicProcedure.mutation(async () => {
    try {
      // Trigger sync in background (don't wait for completion)
      triggerManualSync().catch((error) => {
        console.error("Manual sync failed:", error);
      });

      return {
        success: true,
        message: "Sync triggered successfully (running in background)",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to trigger sync",
      };
    }
  }),

  /**
   * Get system health metrics
   */
  getSystemMetrics: publicProcedure.query(async () => {
    try {
      // Get disk usage
      const { stdout: diskOutput } = await execAsync("df -h /home/ubuntu | awk 'NR==2 {print $5}' | sed 's/%//'");
      const diskUsage = parseInt(diskOutput.trim());

      // Get database size
      const { stdout: dbSizeOutput } = await execAsync(
        "mysql -sN -e \"SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) FROM information_schema.tables WHERE table_schema = DATABASE()\""
      );
      const dbSizeMB = parseFloat(dbSizeOutput.trim());

      // Get backup count
      const { stdout: backupOutput } = await execAsync(
        "ls -1 /home/ubuntu/analytics-dashboard/backups/backup_*.sql 2>/dev/null | wc -l"
      );
      const backupCount = parseInt(backupOutput.trim());

      return {
        diskUsage,
        diskStatus: diskUsage > 80 ? "critical" : diskUsage > 60 ? "warning" : "healthy",
        databaseSizeMB: dbSizeMB,
        backupCount,
        backupStatus: backupCount > 0 ? "healthy" : "warning",
      };
    } catch (error) {
      return {
        diskUsage: 0,
        diskStatus: "unknown" as const,
        databaseSizeMB: 0,
        backupCount: 0,
        backupStatus: "unknown" as const,
      };
    }
  }),
});
