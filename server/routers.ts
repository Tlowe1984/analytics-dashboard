import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
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
});

export type AppRouter = typeof appRouter;
