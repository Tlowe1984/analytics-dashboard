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
import { syncMetadata } from "../drizzle/schema";

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

    // Get section-specific last updated timestamps
    getDevicesLastUpdated: publicProcedure.query(async () => {
      return await db.getDevicesLastUpdated();
    }),

    getSoftwareLastUpdated: publicProcedure.query(async () => {
      return await db.getSoftwareLastUpdated();
    }),

    getSystemsLastUpdated: publicProcedure.query(async () => {
      return await db.getSystemsLastUpdated();
    }),

    // Get source document URL by section
    getSourceDocumentUrl: publicProcedure
      .input(z.object({ section: z.enum(['devices', 'software', 'systems']).optional() }).optional())
      .query(async ({ input }) => {
        const section = input?.section || 'software';
        // Fallback URLs by section
        const fallbackUrls = {
          devices: 'https://fburl.com/devicegrowthpr', // Keep existing Devices link
          software: 'https://drive.google.com/drive/folders/1JY78rUBZquuOd2kCVzTU6_t_ozM3DH7I',
          systems: 'https://drive.google.com/drive/folders/1Qf4aS6k4QbCd_0DF2OCz7AMSUiKFvFWw',
        };
        try {
          const database = await db.getDb();
          if (!database) {
            return fallbackUrls[section];
          }
          const result = await (database.query as any).syncMetadata.findFirst({
            where: (syncMetadata: any, { eq }: any) => eq(syncMetadata.section, section),
            columns: { sourceUrl: true },
          });
          return result?.sourceUrl || fallbackUrls[section];
        } catch (error) {
          // If database query fails, return fallback URL
          console.error('Error fetching source URL:', error);
          return fallbackUrls[section];
        }
      }),

    // Get source file metadata (filename + modified date) for a given section
    getSourceFileMeta: publicProcedure
      .input(z.object({ section: z.string() }))
      .query(async ({ input }) => {
        try {
          const database = await db.getDb();
          if (!database) return null;
          const result = await (database.query as any).syncMetadata.findFirst({
            where: (sm: any, { eq }: any) => eq(sm.section, input.section),
            columns: { sourceFileName: true, fileModifiedAt: true, sourceFileUrl: true },
          });
          return result ? {
            sourceFileName: result.sourceFileName || null,
            fileModifiedAt: result.fileModifiedAt || null,
            sourceFileUrl: result.sourceFileUrl || null,
          } : null;
        } catch (error) {
          console.error('Error fetching source file meta:', error);
          return null;
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
        
        // Get ALL data from all 8 sources + source file metadata
        const database = await db.getDb();
        const [dashboardItems, softwareItems, systemsItems, allDecisions, upcomingReviews, milestones, hearingItems, aiItems] = await Promise.all([
          db.getAllDashboardItems(),
          db.getAllSoftwareItems(),
          db.getAllSystemsItems(),
          db.getAllDecisions(),
          db.getUpcomingReviews(),
          db.getAllMilestones(),
          db.getAllHearingItems(),
          db.getAllAiItems(),
        ]);

        // Fetch source file metadata for all sections
        let sourceMetaContext = '';
        if (database) {
          try {
            const allMeta = await database.select().from(syncMetadata);
            if (allMeta.length > 0) {
              const metaLines = allMeta
                .filter(m => m.sourceFileName)
                .map(m => {
                  const modified = m.fileModifiedAt ? new Date(m.fileModifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown';
                  return `  - ${m.section}: "${m.sourceFileName}" (last modified: ${modified})`;
                });
              if (metaLines.length > 0) {
                sourceMetaContext = `\n=== DATA SOURCE FILES ===\n${metaLines.join('\n')}\n`;
              }
            }
          } catch (_) { /* ignore */ }
        }
        
        // Format Exec Summary data (Devices - AI Glasses, Wrist, ARG/SSG highlights & risks)
        const execSummaryContext = dashboardItems.map(item => 
          `[DEVICES - ${item.productCategory.toUpperCase()}] ${item.sectionType}: ${item.content}`
        ).join("\n");
        
        // Format Software / E&I Review data (only [wearables-tag] items)
        const softwareContext = softwareItems
          .filter(item => item.isWearablesTag === 1)
          .map(item => `[E&I / SOFTWARE REVIEW] ${item.sectionType}${item.forum ? ' | Forum: ' + item.forum : ''}: ${item.content.replace(/\[wearables-tag\]/gi, '').trim()}`)
          .join("\n");
        
        // Format Systems Review data (only [wearables-tag] items)
        const systemsContext = systemsItems
          .filter(item => item.isWearablesTag === 1)
          .map(item => `[SYSTEMS REVIEW] ${item.sectionType}: ${item.content.replace(/\[wearables-tag\]/gi, '').trim()}`)
          .join("\n");
        
        // Format Decisions data (all 20 weeks of history for full context)
        const decisionsContext = allDecisions
          .filter(item => !(item.dri || '').toLowerCase().includes('timothy lowe'))
          .filter(item => !(item.decisionOutcome || '').toLowerCase().includes('cannot be displayed'))
          .map(item => 
            `[DECISION - ${item.week}] Status: ${item.status || 'N/A'} | DRI: ${item.dri} | Forum: ${item.forum} | ${item.decisionOutcome}`
          ).join("\n");
        
        // Format Upcoming Reviews data
        const reviewsContext = upcomingReviews.map(item => 
          `[UPCOMING REVIEW - ${item.reviewType}] Week ${item.week} (${item.date}) | Topic: ${item.topic} | Owner: ${item.owner}${item.description ? ' | ' + item.description : ''}`
        ).join("\n");
        
        // Format Milestones data
        const milestonesContext = milestones.map(item => 
          `[MILESTONE - ${item.milestoneType}] ${item.milestoneDate} | Product: ${item.product} | ${item.milestoneName}`
        ).join("\n");
        
        // Format Hearing / Health Review data
        const hearingContext = hearingItems.map(item =>
          `[HEALTH REVIEW] ${item.sectionType}: ${item.content}`
        ).join("\n");

        // Format AI Review data
        const aiContext = aiItems.map(item =>
          `[AI REVIEW] ${item.sectionType}: ${item.content}`
        ).join("\n");

        // Combine all data
        const fullDataContext = [
          sourceMetaContext,
          "=== EXECUTIVE SUMMARY (DEVICES) ===",
          execSummaryContext || "(no data)",
          "",
          "=== EXPERIENCES & INTERFACES / SOFTWARE REVIEW ===",
          softwareContext || "(no data)",
          "",
          "=== SYSTEMS REVIEW ===",
          systemsContext || "(no data)",
          "",
          "=== HEALTH / HEARING REVIEW ===",
          hearingContext || "(no data)",
          "",
          "=== AI REVIEW ===",
          aiContext || "(no data)",
          "",
          "=== DECISIONS (last 20 weeks) ===",
          decisionsContext || "(no data)",
          "",
          "=== UPCOMING REVIEWS ===",
          reviewsContext || "(no data)",
          "",
          "=== PDP MILESTONES ===",
          milestonesContext || "(no data)",
        ].join("\n");
        
        const systemPrompt = `You are an AI assistant helping analyze a comprehensive executive dashboard for a wearables product program. Today's date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

The dashboard integrates data from 8 sources:
1. Devices (Executive Summary): Highlights, risks, and upcoming items for AI Glasses, Wrist, and ARG/SSG products
2. Experiences & Interfaces (E&I / Software Review): Software development updates, wins, and risks — pre-filtered to wearables-relevant items only
3. Systems Review: Systems engineering updates — pre-filtered to wearables-relevant items only
4. Health / Hearing Review: Health and hearing product review updates
5. AI Review: AI features, hotspots, and product review updates
6. Decisions: Program decisions with week, DRI (Directly Responsible Individual), forum, and outcome — last 20 weeks of history
7. Upcoming Reviews: Scheduled product, systems, and wearables reviews with dates and owners
8. PDP Milestones: Key dates for product development phases, releases, and launches

Current dashboard data:
${fullDataContext}

Answer the user's question based on this comprehensive data. Be specific and cite relevant information. If data contains hyperlinks in markdown format [text](url), include them in your answer. If asked about data freshness or sources, refer to the DATA SOURCE FILES section.`;
        
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
      // Get all data
      const [dashboardItems, softwareItems, systemsItems] = await Promise.all([
        db.getAllDashboardItems(),
        db.getAllSoftwareItems(),
        db.getAllSystemsItems(),
      ]);
      
      // Return ALL items directly (no LLM summarization)
      const devicesHighlights = dashboardItems
        .filter(item => item.sectionType === "highlights" && item.productCategory === "general")
        .map(item => ({ content: item.content, indentLevel: item.indentLevel || 0 }));
      
      const devicesRisks = dashboardItems
        .filter(item => item.sectionType === "risks" && item.productCategory === "general")
        .map(item => ({ content: item.content, indentLevel: item.indentLevel || 0 }));
      
      // Software data - only show items tagged with [wearables-tag], strip tag from display
      const softwareHighlights = softwareItems
        .filter(item => item.sectionType === "wins" && item.isWearablesTag === 1)
        .map(item => item.content.replace(/\[wearables-tag\]/gi, '').trim());
      
      const softwareRisks = softwareItems
        .filter(item => item.sectionType === "exec_summary" && item.isWearablesTag === 1)
        .map(item => item.content.replace(/\[wearables-tag\]/gi, '').trim());
      
      // Systems data - only show items tagged with [wearables-tag], strip tag from display
      const systemsHighlights = systemsItems
        .filter(item => item.sectionType === "wins" && item.isWearablesTag === 1)
        .map(item => item.content.replace(/\[wearables-tag\]/gi, '').trim());
      
      const systemsRisks = systemsItems
        .filter(item => item.sectionType === "exec_summary" && item.isWearablesTag === 1)
        .map(item => item.content.replace(/\[wearables-tag\]/gi, '').trim());
      
      return {
        devices: { highlights: devicesHighlights, risks: devicesRisks },
        software: { highlights: softwareHighlights, risks: softwareRisks },
        systems: { highlights: systemsHighlights, risks: systemsRisks },
      };
    }),

    // Get upcoming items for AI Executive Updates (PDP gates + upcoming decisions)
    getUpcomingItems: publicProcedure.query(async () => {
      return await db.getUpcomingItemsForAI(6);
    }),

    // Get Software items tagged with [Wearables-tag]
    getWearablesTaggedItems: publicProcedure.query(async () => {
      return await db.getSoftwareItemsWithWearablesTag();
    }),

    // Get PDP milestones for this week and next week
    getPDPMilestonesThisAndNextWeek: publicProcedure.query(async () => {
      return await db.getPDPMilestonesThisAndNextWeek();
    }),

    // Get recent decisions for AI Executive Updates top tile
    // Rules: last 2 weeks only, max 8, MZ first, exclude Timothy Lowe, exclude 'cannot be displayed'
    // Summaries are generated using LLM to keep them concise (≤60 words)
    // Format: **Forum**: Summary. [Link]
    getRecentDecisions: publicProcedure.query(async () => {
      const { invokeLLM } = await import("./_core/llm");
      const rawDecisions = await db.getRecentDecisionsForAI(8);
      
      if (rawDecisions.length === 0) {
        return [];
      }
      
      // Prepare prompt for LLM to summarize decisions with new format
      const decisionsText = rawDecisions.map((d, idx) => 
        `${idx + 1}. Forum: ${d.forum}\nOutcome: ${d.outcome}`
      ).join('\n\n');
      
      const prompt = `For each decision below, format as: **Forum**: Summary (60 words max). [Link]
Rules:
1. Start with forum name in bold markdown: **Forum Name**:
2. Follow with concise outcome summary (up to 60 words, no bolding in the summary text)
3. Extract and preserve any links at the end as [Post](url) or [Link](url)
4. If no link in outcome, omit the link part

Examples:
- "**MZ**: Malibu2 LE steers on 3rd button follow-up with workshop and watch-face experiences. [Post](url)"
- "**Wearables Review**: Meta AI 2.0 architecture strategy approved with GO for W06 Experiences & Interfaces Review. [Post](url)"
- "**Product Council**: HN1 LE limited to Elite Bundle; Ceres included with blue transparent frame."

Return as JSON array:
[
  { "summary": "**Forum**: Summary. [Link](url)" }
]

${decisionsText}

Return ONLY valid JSON, no other text.`;
      
      try {
        const response = await invokeLLM({
          messages: [{ role: "user", content: prompt as string }],
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
        if (!content || typeof content !== 'string') {
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
        // Check if sandbox tools (rclone + Python venv) are available
        const { execSync } = await import('child_process');
        let hasSandboxTools = false;
        try {
          execSync('which rclone', { stdio: 'ignore' });
          hasSandboxTools = true;
        } catch {
          hasSandboxTools = false;
        }

        if (!hasSandboxTools) {
          // Not in sandbox: Cannot run sync (no rclone available)
          console.log('[SYNC] Sandbox tools not available: Manual sync disabled');
          const message = 'Manual sync requires sandbox tools (rclone/Python). Data syncs automatically daily at 6 AM PST.';
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

    // Get wearables-tagged items from AI and Hearing reviews
    getWearablesTagged: publicProcedure.query(async () => {
      return await db.getWearablesTaggedItems();
    }),
  }),

  hearing: router({
    // Get all hearing (health) review items
    getAll: publicProcedure.query(async () => {
      return await db.getAllHearingItems();
    }),

    // Get items by section type
    getBySection: publicProcedure
      .input(
        z.object({
          sectionType: z.enum(["wins", "exec_summary", "decisions"]),
        })
      )
      .query(async ({ input }) => {
        return await db.getHearingItemsBySection(input.sectionType);
      }),
  }),

  ai: router({
    // Get all AI review items
    getAll: publicProcedure.query(async () => {
      return await db.getAllAiItems();
    }),

    // Get items by section type
    getBySection: publicProcedure
      .input(
        z.object({
          sectionType: z.enum(["wins", "exec_summary", "decisions"]),
        })
      )
      .query(async ({ input }) => {
        return await db.getAiItemsBySection(input.sectionType);
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

    // Get upcoming GTM milestones (next 10 weeks)
    getGTMMilestones: publicProcedure
      .input(
        z.object({
          limit: z.number().default(50),
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

  pdpStatus: router({
    // Get all PDP status rows ordered by sort_order
    getAll: publicProcedure.query(async () => {
      return await db.getAllPdpStatus();
    }),
  }),
});

export type AppRouter = typeof appRouter;
