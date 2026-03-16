/**
 * load_decisions.ts
 * Loads parsed decisions JSON into the database with:
 *  - Post-insert count validation (aborts if DB count < inserted count)
 *  - Regression warning if new count is >20% lower than previous count
 *  - syncMetadata write so the dashboard can report last-synced timestamp
 *
 * Usage: pnpm exec tsx server/load_decisions.ts <json_file>
 */
import fs from 'fs';
import { getDb, clearDecisions, insertDecision } from './db';
import { decisions, syncMetadata } from '../drizzle/schema';
import { eq, count } from 'drizzle-orm';

async function loadDecisions() {
  const jsonPath = process.argv[2] || '/tmp/decisions_data.json';
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Snapshot current count before clearing (for regression detection)
  const [beforeRow] = await db.select({ count: count() }).from(decisions);
  const previousCount = Number(beforeRow?.count ?? 0);

  // Clear existing decisions
  await clearDecisions();

  // Insert new decisions
  console.log(`Loading ${data.length} decisions into database (was ${previousCount})...`);
  let inserted = 0;
  for (const decision of data) {
    try {
      await insertDecision({
        week: decision.week,
        dri: decision.dri,
        forum: decision.forum || '',
        status: decision.status || '',
        decisionOutcome: decision.decision_outcome
      });
      inserted++;
    } catch (err: any) {
      console.error(`⚠️ Failed to insert decision week=${decision.week} dri=${decision.dri}: ${err.message}`);
    }
  }

  // ── Post-insert validation ──────────────────────────────────────────────
  const [afterRow] = await db.select({ count: count() }).from(decisions);
  const finalCount = Number(afterRow?.count ?? 0);

  if (finalCount < inserted) {
    throw new Error(`DB count mismatch: inserted ${inserted} but DB shows ${finalCount} — aborting`);
  }

  // Warn if we loaded significantly fewer than before (>20% drop = suspicious)
  if (previousCount > 0 && finalCount < previousCount * 0.8) {
    console.warn(`⚠️ WARNING: Loaded ${finalCount} decisions but previously had ${previousCount} — possible data loss`);
  }

  // ── Write syncMetadata so dashboard can report count + timestamp ────────
  const now = new Date();
  const existing = await db.select().from(syncMetadata).where(eq(syncMetadata.section, 'decisions')).limit(1);
  if (existing.length > 0) {
    await db.update(syncMetadata).set({
      sourceFileName: 'Wearable Decisions Canonical .docx',
      sourceFileUrl: 'https://drive.google.com/drive/folders/1Wearables_Everything',
      lastSyncedAt: now,
      syncStatus: 'success',
    }).where(eq(syncMetadata.section, 'decisions'));
  } else {
    await db.insert(syncMetadata).values({
      section: 'decisions',
      documentId: 'decisions_canonical',
      sourceFileName: 'Wearable Decisions Canonical .docx',
      sourceFileUrl: 'https://drive.google.com/drive/folders/1Wearables_Everything',
      lastSyncedAt: now,
      syncStatus: 'success',
    });
  }

  console.log(`Loaded ${finalCount} decisions into database successfully!`);
  process.exit(0);
}

loadDecisions().catch(err => {
  console.error('Error loading decisions:', err);
  process.exit(1);
});
