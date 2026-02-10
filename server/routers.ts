import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { syncAll, syncExecutiveSummary, syncMilestones } from "./googleDriveSync";
import { syncAllBash } from "./syncAllBash";
import { invalidateDashboardCache } from "./query-cache";
import { syncMonitoringRouter } from "./sync-monitoring";

export const appRouter = router({
  system: systemRouter,
  syncMonitoring: syncMonitoringRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  dashboard: router({
    // Get all dashboard items
    getAll: publicProcedure.query(async () => {
      return await db.getAllDashboardItems();
    }),

    // Get last updated timestamp
    getLastUpdated: publicProcedure.query(async () => {
      return await db.getLastUpdatedTimestamp();
    }),

    // Get source document URL by section
    getSourceDocumentUrl: publicProcedure
      .input(z.object({ section: z.enum(['devices', 'software', 'systems']).optional() }).optional())
      .query(async ({ input }) => {
        const section = input?.section || 'software';
        // Fallback URLs by section
        const fallbackUrls = {
          devices: 'https://fburl.com/devicegrowthpr', // Keep existing Devices link
          software: 'https://drive.google.com/drive/folders/1WUVIL8v9oQS7Mvc7Snz5lHBhKth-8f9h',
          systems: 'https://drive.google.com/drive/folders/1Qf4aS6k4QbCd_0DF2OCz7AMSUiKFvFWw',
        };
        try {
          const result = await db.query.syncMetadata.findFirst({
            where: (syncMetadata, { eq }) => eq(syncMetadata.section, section),
            columns: { sourceUrl: true },
          });
          return result?.sourceUrl || fallbackUrls[section];
        } catch (error) {
          // If database query fails, return fallback URL
          console.error('Error fetching source URL:', error);
          return fallbackUrls[section];
        }
      }),

    // Get items by section and category
    getBySection: publicProcedure
      .input(
        z.object({
          sectionType: z.enum(["highlights", "risks", "upcoming"]),
          productCategory: z.enum(["ai_glasses", "wrist", "arg_ssg"]),
        })
      )
      .query(async ({ input }) => {
        return await db.getDashboardItemsBySection(input.sectionType, input.productCategory);
      }),

    // Create new dashboard item (protected - admin only)
    create: protectedProcedure
      .input(
        z.object({
          sectionType: z.enum(["highlights", "risks", "upcoming"]),
          productCategory: z.enum(["ai_glasses", "wrist", "arg_ssg"]),
          content: z.string().min(1),
          order: z.number().default(0),
        })
      )
      .mutation(async ({ input }) => {
        return await db.createDashboardItem(input);
      }),

    // Update dashboard item
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        return await db.updateDashboardItem(input.id, input.content);
      }),

    // Delete dashboard item
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await db.deleteDashboardItem(input.id);
      }),

    // Ask AI question about dashboard data - Enhanced with ALL data sources
    askQuestion: publicProcedure
      .input(z.object({ question: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        // Get ALL data from all sources
        const [dashboardItems, softwareItems, systemsItems, decisions, upcomingReviews, milestones] = await Promise.all([
          db.getAllDashboardItems(),
          db.getAllSoftwareItems(),
          db.getAllSystemsItems(),
          db.getAllDecisions(),
          db.getUpcomingReviews(),
          db.getAllMilestones(),
        ]);
        
        // Format Exec Summary data
        const execSummaryContext = dashboardItems.map(item => 
          `[EXEC SUMMARY - ${item.productCategory.toUpperCase()}] ${item.sectionType}: ${item.content}`
        ).join("\n");
        
        // Format Software Review data
        const softwareContext = softwareItems.map(item => 
          `[SOFTWARE REVIEW] ${item.sectionType}: ${item.content}`
        ).join("\n");
        
        // Format Systems Review data
        const systemsContext = systemsItems.map(item => 
          `[SYSTEMS REVIEW] ${item.sectionType}: ${item.content}`
        ).join("\n");
        
        // Format Decisions data
        const decisionsContext = decisions.map(item => 
          `[DECISION - Week ${item.week}] ${item.status} | DRI: ${item.dri} | Forum: ${item.forum} | ${item.decision}`
        ).join("\n");
        
        // Format Upcoming Reviews data
        const reviewsContext = upcomingReviews.map(item => 
          `[UPCOMING REVIEW - ${item.reviewType}] Week ${item.week} (${item.date}) | Topic: ${item.topic} | Owner: ${item.owner}${item.description ? ' | ' + item.description : ''}`
        ).join("\n");
        
        // Format Milestones data
        const milestonesContext = milestones.map(item => 
          `[MILESTONE - ${item.milestoneType}] ${item.date} | Product: ${item.product} | ${item.description}`
        ).join("\n");
        
        // Combine all data
        const fullDataContext = [
          "=== EXECUTIVE SUMMARY ===",
          execSummaryContext,
          "",
          "=== SOFTWARE REVIEWS ===",
          softwareContext,
          "",
          "=== SYSTEMS REVIEWS ===",
          systemsContext,
          "",
          "=== DECISIONS ===",
          decisionsContext,
          "",
          "=== UPCOMING REVIEWS ===",
          reviewsContext,
          "",
          "=== MILESTONES ===",
          milestonesContext,
        ].join("\n");
        
        const systemPrompt = `You are an AI assistant helping analyze a comprehensive executive dashboard for a wearables program. The dashboard contains:

1. Executive Summary: Product highlights, risks, and upcoming items for AI Glasses, Wrist, and ARG/SSG
2. Software Reviews: Software development updates and status
3. Systems Reviews: Systems engineering updates and status
4. Decisions: Recent program decisions with DRI (Directly Responsible Individual) and forum information
5. Upcoming Reviews: Scheduled product, systems, and wearables reviews
6. Milestones: Key dates for releases, launches, and program milestones

Current dashboard data:
${fullDataContext}

Answer the user's question based on this comprehensive data. Be specific, cite relevant information, and provide actionable insights. If the data contains hyperlinks in markdown format [text](url), you can reference them in your answer.`;
        
        const response = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: input.question },
          ],
        });
        
        return {
          answer: response.choices[0]?.message?.content || "I couldn't generate an answer.",
        };
      }),


    // Generate AI summaries for all sections (Devices, Software, Systems)
    generateExecutiveSummaries: publicProcedure.query(async () => {
      const { invokeLLM } = await import("./_core/llm");
      
      // Get all data
      const [dashboardItems, softwareItems, systemsItems] = await Promise.all([
        db.getAllDashboardItems(),
        db.getAllSoftwareItems(),
        db.getAllSystemsItems(),
      ]);
      
      // Format Devices data
      const devicesHighlights = dashboardItems
        .filter(item => item.sectionType === "highlights")
        .map(item => item.content)
        .join("\n");
      
      const devicesRisks = dashboardItems
        .filter(item => item.sectionType === "risks")
        .map(item => item.content)
        .join("\n");
      
      // Format Software data (uses "wins" and "exec_summary")
      const softwareHighlights = softwareItems
        .filter(item => item.sectionType === "wins")
        .map(item => item.content)
        .join("\n");
      
      const softwareRisks = softwareItems
        .filter(item => item.sectionType === "exec_summary")
        .map(item => item.content)
        .join("\n");
      
      // Format Systems data (uses "wins" and "help_needed")
      const systemsHighlights = systemsItems
        .filter(item => item.sectionType === "wins")
        .map(item => item.content)
        .join("\n");
      
      const systemsRisks = systemsItems
        .filter(item => item.sectionType === "help_needed")
        .map(item => item.content)
        .join("\n");
      
      const prompt = `You are extracting key bullets from executive dashboard data. For each section (Devices, Software, Systems), select 2-3 most important bullets for Highlights and 2-3 for Risks/Opens.

IMPORTANT RULES:
1. Keep ALL emojis (🎉, ⚠️, 🔴, ✅, 🟢, etc.)
2. Keep ALL markdown links [text](url)
3. Include program names (e.g., RBM2, Luna, Artemis, Modelo)
4. Return as JSON with this structure:
{
  "devices": { "highlights": ["bullet1", "bullet2"], "risks": ["bullet1", "bullet2"] },
  "software": { "highlights": ["bullet1", "bullet2"], "risks": ["bullet1", "bullet2"] },
  "systems": { "highlights": ["bullet1", "bullet2"], "risks": ["bullet1", "bullet2"] }
}

=== DEVICES DATA ===
Highlights:
${devicesHighlights}

Risks/Opens:
${devicesRisks}

=== SOFTWARE DATA ===
Highlights:
${softwareHighlights}

Risks/Opens:
${softwareRisks}

=== SYSTEMS DATA ===
Highlights:
${systemsHighlights}

Risks/Opens:
${systemsRisks}

Return ONLY valid JSON, no other text.`;
      
      const response = await invokeLLM({
        messages: [
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "executive_summaries",
            strict: true,
            schema: {
              type: "object",
              properties: {
                devices: {
                  type: "object",
                  properties: {
                    highlights: { type: "array", items: { type: "string" } },
                    risks: { type: "array", items: { type: "string" } },
                  },
                  required: ["highlights", "risks"],
                  additionalProperties: false,
                },
                software: {
                  type: "object",
                  properties: {
                    highlights: { type: "array", items: { type: "string" } },
                    risks: { type: "array", items: { type: "string" } },
                  },
                  required: ["highlights", "risks"],
                  additionalProperties: false,
                },
                systems: {
                  type: "object",
                  properties: {
                    highlights: { type: "array", items: { type: "string" } },
                    risks: { type: "array", items: { type: "string" } },
                  },
                  required: ["highlights", "risks"],
                  additionalProperties: false,
                },
              },
              required: ["devices", "software", "systems"],
              additionalProperties: false,
            },
          },
        },
      });
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          devices: { highlights: [], risks: [] },
          software: { highlights: [], risks: [] },
          systems: { highlights: [], risks: [] },
        };
      }
      
      return JSON.parse(content);
    }),

    // Get upcoming items for AI Executive Updates (PDP gates + upcoming decisions)
    getUpcomingItems: publicProcedure.query(async () => {
      return await db.getUpcomingItemsForAI(6);
    }),

    // Get PDP milestones for this week and next week
    getPDPMilestonesThisAndNextWeek: publicProcedure.query(async () => {
      return await db.getPDPMilestonesThisAndNextWeek();
    }),

    // Get recent decisions for AI Executive Updates (Decisions table + Software Pillar decisions)
    // Summaries are generated using LLM to keep them concise (≤15 words)
    getRecentDecisions: publicProcedure.query(async () => {
      const { invokeLLM } = await import("./_core/llm");
      const rawDecisions = await db.getRecentDecisionsForAI(7);
      
      if (rawDecisions.length === 0) {
        return [];
      }
      
      // Prepare prompt for LLM to summarize decisions
      const decisionsText = rawDecisions.map((d, idx) => 
        `${idx + 1}. Forum: ${d.forum}\nOutcome: ${d.outcome}`
      ).join('\n\n');
      
      const prompt = `For each decision below, write a concise summary (up to 25 words) focusing on the outcome. Preserve any [links](url) at the end.

Examples:
- "Malibu2 LE steers on 3rd button follow-up with MZ, workshop, and watch-face experiences. [Post](url)"
- "Meta AI 2.0 architecture strategy approved with GO for W06 Experiences & Interfaces Review. [Post](url)"
- "HN1 LE limited to Elite Bundle; Ceres included with blue transparent frame. [Post](url)"

Return as JSON array with this structure:
[
  { "summary": "Outcome summary. [link](url)" }
]

${decisionsText}

Return ONLY valid JSON, no other text.`;
      
      try {
        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "decision_summaries",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summaries: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        summary: { type: "string" },
                      },
                      required: ["summary"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summaries"],
                additionalProperties: false,
              },
            },
          },
        });
        
        const content = response.choices[0]?.message?.content;
        if (!content) {
          return rawDecisions; // Fallback to raw data
        }
        
        const parsed = JSON.parse(content);
        return parsed.summaries.map((s: any) => ({
          outcome: s.summary,
        }));
      } catch (error) {
        console.error("[LLM] Error summarizing decisions:", error);
        return rawDecisions; // Fallback to raw data
      }
    }),

    // Seed sample data
    seedSampleData: protectedProcedure.mutation(async () => {
      // Clear existing data first
      await db.clearAllDashboardItems();

      // Sample data for the 3x3 grid
      const sampleData = [
        // AI Glasses - Highlights
        { sectionType: "highlights" as const, productCategory: "ai_glasses" as const, content: "Prototype testing exceeded performance targets by 15%", order: 1 },
        { sectionType: "highlights" as const, productCategory: "ai_glasses" as const, content: "Successfully integrated new AI processing chip", order: 2 },
        { sectionType: "highlights" as const, productCategory: "ai_glasses" as const, content: "User feedback scores averaging 4.7/5 in pilot program", order: 3 },

        // AI Glasses - Risks
        { sectionType: "risks" as const, productCategory: "ai_glasses" as const, content: "Battery life optimization still 20% below target", order: 1 },
        { sectionType: "risks" as const, productCategory: "ai_glasses" as const, content: "Supply chain delays for optical components", order: 2 },
        { sectionType: "risks" as const, productCategory: "ai_glasses" as const, content: "Thermal management requires additional engineering", order: 3 },

        // AI Glasses - Upcoming
        { sectionType: "upcoming" as const, productCategory: "ai_glasses" as const, content: "Q2 design review scheduled for March 15", order: 1 },
        { sectionType: "upcoming" as const, productCategory: "ai_glasses" as const, content: "Beta program launch targeting 500 users in April", order: 2 },
        { sectionType: "upcoming" as const, productCategory: "ai_glasses" as const, content: "Manufacturing partner selection by end of Q1", order: 3 },

        // Wrist - Highlights
        { sectionType: "highlights" as const, productCategory: "wrist" as const, content: "Health sensor accuracy improved to 98.5%", order: 1 },
        { sectionType: "highlights" as const, productCategory: "wrist" as const, content: "New gesture control system fully functional", order: 2 },
        { sectionType: "highlights" as const, productCategory: "wrist" as const, content: "Battery life extended to 72 hours in testing", order: 3 },

        // Wrist - Risks
        { sectionType: "risks" as const, productCategory: "wrist" as const, content: "Water resistance certification pending additional tests", order: 1 },
        { sectionType: "risks" as const, productCategory: "wrist" as const, content: "Display brightness needs improvement for outdoor use", order: 2 },
        { sectionType: "risks" as const, productCategory: "wrist" as const, content: "Cost per unit 12% above target budget", order: 3 },

        // Wrist - Upcoming
        { sectionType: "upcoming" as const, productCategory: "wrist" as const, content: "Final design freeze scheduled for February 28", order: 1 },
        { sectionType: "upcoming" as const, productCategory: "wrist" as const, content: "Regulatory compliance testing begins March 1", order: 2 },
        { sectionType: "upcoming" as const, productCategory: "wrist" as const, content: "Marketing campaign kickoff planned for Q2", order: 3 },

        // ARG/SSG - Highlights
        { sectionType: "highlights" as const, productCategory: "arg_ssg" as const, content: "Spatial mapping accuracy improved by 30%", order: 1 },
        { sectionType: "highlights" as const, productCategory: "arg_ssg" as const, content: "Successfully demonstrated multi-user collaboration", order: 2 },
        { sectionType: "highlights" as const, productCategory: "arg_ssg" as const, content: "Developer SDK adoption exceeding projections", order: 3 },

        // ARG/SSG - Risks
        { sectionType: "risks" as const, productCategory: "arg_ssg" as const, content: "Content ecosystem development slower than expected", order: 1 },
        { sectionType: "risks" as const, productCategory: "arg_ssg" as const, content: "Network latency issues in edge cases", order: 2 },
        { sectionType: "risks" as const, productCategory: "arg_ssg" as const, content: "Privacy framework requires legal review", order: 3 },

        // ARG/SSG - Upcoming
        { sectionType: "upcoming" as const, productCategory: "arg_ssg" as const, content: "Developer conference scheduled for April 20-22", order: 1 },
        { sectionType: "upcoming" as const, productCategory: "arg_ssg" as const, content: "Enterprise pilot program launching with 5 partners", order: 2 },
        { sectionType: "upcoming" as const, productCategory: "arg_ssg" as const, content: "Platform security audit completion by March 31", order: 3 },
      ];

      // Insert all sample data
      for (const item of sampleData) {
        await db.createDashboardItem(item);
      }

      return { success: true, itemsCreated: sampleData.length };
    }),
  }),

  sync: router({
    // Sync all data from Google Drive
    syncAll: protectedProcedure
      .input(z.object({ forceRefresh: z.boolean().optional() }).optional())
      .mutation(async ({ input }) => {
        // Check if we're in production (no Python available)
        const isProduction = process.env.NODE_ENV === 'production';
        
        if (isProduction) {
          // Production: Cannot run sync (no Python/rclone), return message
          console.log('[SYNC] Production mode: Manual sync disabled');
          const message = 'Manual sync is not available in production. Data syncs automatically daily at 6 AM PST in the sandbox environment.';
          return {
            devices: { success: false, message, timestamp: new Date() },
            software: { success: false, message, timestamp: new Date() },
            systems: { success: false, message, timestamp: new Date() },
            decisions: { success: false, message, timestamp: new Date() },
            milestones: { success: false, message, timestamp: new Date() },
            upcomingReviews: { success: false, message, timestamp: new Date() },
          };
        }
        
        // Development/Sandbox: Run sync using bash scripts (with weekly archive detection)
        console.log('[SYNC] Development mode: Running sync via bash scripts');
        const result = await syncAllBash();
        // Invalidate cache after sync completes so frontend gets fresh data
        invalidateDashboardCache();
        return {
          ...result,
          upcomingReviews: { success: true, message: 'Skipped', timestamp: new Date() }
        };
      }),

    // Sync only executive summary
    syncExecSummary: protectedProcedure.mutation(async () => {
      const result = await syncExecutiveSummary();
      return result;
    }),

    // Sync only milestones
    syncMilestones: protectedProcedure.mutation(async () => {
      const result = await syncMilestones();
      return result;
    }),
  }),

  software: router({
    // Get all software review items
    getAll: publicProcedure.query(async () => {
      return await db.getAllSoftwareItems();
    }),

    // Get items by section and category
    getBySection: publicProcedure
      .input(
        z.object({
          softwareCategory: z.enum(["software_ie", "software_ai", "software_hearing"]),
          sectionType: z.enum(["wins", "exec_summary", "decisions"]),
        })
      )
      .query(async ({ input }) => {
        return await db.getSoftwareItemsBySection(input.softwareCategory, input.sectionType);
      }),
  }),

  milestones: router({
    // Get upcoming milestones by type
    getUpcoming: publicProcedure
      .input(
        z.object({
          milestoneType: z.enum(["pdp_gates", "sdp_milestones", "sw_milestones", "hw_dates"]),
          limit: z.number().default(10),
        })
      )
      .query(async ({ input }) => {
        return await db.getUpcomingMilestones(input.milestoneType, input.limit);
      }),

    // Get upcoming release dates (OSD, launch, release milestones)
    getReleaseDates: publicProcedure
      .input(
        z.object({
          limit: z.number().default(10),
        })
      )
      .query(async ({ input }) => {
        return await db.getReleaseDates(input.limit);
      }),

    // Get upcoming GTM milestones (next 4 weeks)
    getGTMMilestones: publicProcedure
      .input(
        z.object({
          limit: z.number().default(10),
        })
      )
      .query(async ({ input }) => {
        return await db.getGTMMilestones(input.limit);
      }),

    // Get all milestones by type
    getByType: publicProcedure
      .input(
        z.object({
          milestoneType: z.enum(["pdp_gates", "sdp_milestones", "sw_milestones", "hw_dates"]),
        })
      )
      .query(async ({ input }) => {
        return await db.getAllMilestonesByType(input.milestoneType);
      }),

    // Import milestones from JSON data
    import: protectedProcedure
      .input(
        z.object({
          milestones: z.array(
            z.object({
              product: z.string(),
              milestoneName: z.string(),
              milestoneDate: z.date(),
              milestoneType: z.enum(["pdp_gates", "sdp_milestones", "sw_milestones", "hw_dates"]),
              originalType: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        return await db.importMilestones(input.milestones);
      }),
  }),

  decisions: router({
    // Get all decisions from last month
    getAll: publicProcedure.query(async () => {
      return await db.getAllDecisions();
    }),
  }),

  upcomingReviews: router({
    // Get all upcoming reviews (next 14 days)
    getAll: publicProcedure.query(async () => {
      return await db.getUpcomingReviews();
    }),
  }),

  systems: router({
    // Get all systems items
    getAll: publicProcedure.query(async () => {
      return await db.getAllSystemsItems();
    }),

    // Get systems items by section
    getBySection: publicProcedure
      .input(z.enum(["wins", "exec_summary", "help_needed"]))
      .query(async ({ input }) => {
        return await db.getSystemsItemsBySection(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
