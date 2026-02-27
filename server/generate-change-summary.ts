import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { dashboardItems, softwareItems, systemsItems, hearingItems, aiItems, decisions, milestones, upcomingReviews } from "../drizzle/schema";
import { desc, sql } from "drizzle-orm";

interface ChangeSummary {
  source: string;
  fileName: string;
  lastModified: Date;
  itemsChanged: number;
  summary: string;
  sourceUrl?: string;
}

/**
 * Generate AI summaries of what changed in each data source
 */
export async function generateChangeSummaries(): Promise<ChangeSummary[]> {
  const summaries: ChangeSummary[] = [];

  try {
    const db = await getDb();
    if (!db) return summaries;
    
    // 1. Devices (Dashboard Items)
    const devicesData = await db
      .select()
      .from(dashboardItems)
      .orderBy(desc(dashboardItems.updatedAt))
      .limit(50);
    
    if (devicesData.length > 0) {
      const devicesSummary = await generateAISummary(
        'Devices',
        devicesData.map(d => `${d.sectionType}: ${d.content}`).join('\n\n')
      );
      summaries.push({
        source: 'Devices',
        fileName: 'Device & Growth Canonical Program Review',
        lastModified: devicesData[0].updatedAt,
        itemsChanged: devicesData.length,
        summary: devicesSummary,
        sourceUrl: 'https://docs.google.com/document/d/1cqBEh8pKjvYQT7gBcVNYoEcfcQpEpgzI1sTtBLgqkMI'
      });
    }

    // 2. Software (I+E, AI, Hearing)
    const softwareData = await db
      .select()
      .from(softwareItems)
      .orderBy(desc(softwareItems.updatedAt))
      .limit(50);
    
    if (softwareData.length > 0) {
      const softwareSummary = await generateAISummary(
        'Software',
        softwareData.map(s => `${s.softwareCategory} - ${s.sectionType}: ${s.content}`).join('\n\n')
      );
      summaries.push({
        source: 'Software (I+E, AI, Hearing)',
        fileName: 'I+E, AI, Hearing Canonical Program Review',
        lastModified: softwareData[0].updatedAt,
        itemsChanged: softwareData.length,
        summary: softwareSummary,
        sourceUrl: 'https://docs.google.com/document/d/1ZRnxqQJQZQJQZQJQZQJQZQJQZQJQZQJQZQJQZQJQZQJ'
      });
    }

    // 3. Systems
    const systemsData = await db
      .select()
      .from(systemsItems)
      .orderBy(desc(systemsItems.updatedAt))
      .limit(50);
    
    if (systemsData.length > 0) {
      const systemsSummary = await generateAISummary(
        'Systems',
        systemsData.map(s => `${s.sectionType}: ${s.content}`).join('\n\n')
      );
      summaries.push({
        source: 'Systems',
        fileName: 'Systems Canonical Program Review',
        lastModified: systemsData[0].updatedAt,
        itemsChanged: systemsData.length,
        summary: systemsSummary,
        sourceUrl: 'https://docs.google.com/document/d/1systemsreviewdocid'
      });
    }

    // 4. Hearing
    const hearingData = await db
      .select()
      .from(hearingItems)
      .orderBy(desc(hearingItems.updatedAt))
      .limit(50);
    
    if (hearingData.length > 0) {
      const hearingSummary = await generateAISummary(
        'Hearing',
        hearingData.map(h => `${h.sectionType}: ${h.content}`).join('\n\n')
      );
      summaries.push({
        source: 'Hearing',
        fileName: 'Health Canonical Program Review',
        lastModified: hearingData[0].updatedAt,
        itemsChanged: hearingData.length,
        summary: hearingSummary
      });
    }

    // 5. AI
    const aiData = await db
      .select()
      .from(aiItems)
      .orderBy(desc(aiItems.updatedAt))
      .limit(50);
    
    if (aiData.length > 0) {
      const aiSummary = await generateAISummary(
        'AI',
        aiData.map(a => `${a.sectionType}: ${a.content}`).join('\n\n')
      );
      summaries.push({
        source: 'AI',
        fileName: 'AI Hotspots and Product Review',
        lastModified: aiData[0].updatedAt,
        itemsChanged: aiData.length,
        summary: aiSummary
      });
    }

    // 6. Decisions
    const decisionsData = await db
      .select()
      .from(decisions)
      .orderBy(desc(decisions.updatedAt))
      .limit(50);
    
    if (decisionsData.length > 0) {
      const decisionsSummary = await generateAISummary(
        'Decisions',
        decisionsData.map(d => `${d.decisionOutcome} (Status: ${d.status})`).join('\n\n'),
        true // Prioritize MZ decisions
      );
      summaries.push({
        source: 'Decisions',
        fileName: 'Wearable Decisions Canonical',
        lastModified: decisionsData[0].updatedAt,
        itemsChanged: decisionsData.length,
        summary: decisionsSummary,
        sourceUrl: 'https://docs.google.com/document/d/1decisionsdocid'
      });
    }

    // 7. Milestones
    const milestonesData = await db
      .select()
      .from(milestones)
      .orderBy(desc(milestones.updatedAt))
      .limit(50);
    
    if (milestonesData.length > 0) {
      const milestonesSummary = await generateAISummary(
        'Milestones',
        milestonesData.map(m => `${m.product}: ${m.milestoneName} - ${new Date(m.milestoneDate).toLocaleDateString()} (${m.milestoneType})`).join('\n\n')
      );
      summaries.push({
        source: 'Milestones',
        fileName: 'Wearable Program Milestones SOT',
        lastModified: milestonesData[0].updatedAt,
        itemsChanged: milestonesData.length,
        summary: milestonesSummary
      });
    }

    // 8. Upcoming Reviews
    const reviewsData = await db
      .select()
      .from(upcomingReviews)
      .orderBy(desc(upcomingReviews.updatedAt))
      .limit(50);
    
    if (reviewsData.length > 0) {
      const reviewsSummary = await generateAISummary(
        'Upcoming Reviews',
        reviewsData.map(r => `${r.week}: ${r.reviewType} - ${r.topic}${r.description ? ` (${r.description})` : ''}`).join('\n\n')
      );
      summaries.push({
        source: 'Upcoming Reviews',
        fileName: 'Review Sign-up Sheets',
        lastModified: reviewsData[0].updatedAt,
        itemsChanged: reviewsData.length,
        summary: reviewsSummary
      });
    }

  } catch (error) {
    console.error('Error generating change summaries:', error);
  }

  return summaries;
}

/**
 * Generate AI summary of changes (max 50 words)
 */
async function generateAISummary(
  source: string,
  content: string,
  prioritizeMZ: boolean = false
): Promise<string> {
  try {
    const prompt = prioritizeMZ
      ? `Summarize the key changes and decisions in this ${source} data in exactly 50 words or less. Prioritize any decisions involving "MZ" at the top. Focus on what's new, what changed, and critical updates:\n\n${content.substring(0, 4000)}`
      : `Summarize the key changes and updates in this ${source} data in exactly 50 words or less. Focus on what's new, what changed, and critical updates:\n\n${content.substring(0, 4000)}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a concise executive summary writer. Generate summaries in exactly 50 words or less, focusing on key changes, new items, and critical updates."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const rawContent = response.choices[0]?.message?.content;
    const summary = typeof rawContent === 'string' ? rawContent : 'No changes detected';
    
    // Ensure summary is under 50 words
    const words = summary.split(/\s+/);
    if (words.length > 50) {
      return words.slice(0, 50).join(' ') + '...';
    }
    
    return summary;
  } catch (error) {
    console.error(`Error generating AI summary for ${source}:`, error);
    return 'Unable to generate summary';
  }
}
