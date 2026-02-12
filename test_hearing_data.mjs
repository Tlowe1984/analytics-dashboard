import { getDb } from './server/db.js';
import { hearingItems } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

const db = await getDb();

const wins = await db.select().from(hearingItems).where(eq(hearingItems.sectionType, 'wins'));
console.log('Wins count:', wins.length);

const exec = await db.select().from(hearingItems).where(eq(hearingItems.sectionType, 'exec_summary'));
console.log('Exec Summary count:', exec.length);

const dec = await db.select().from(hearingItems).where(eq(hearingItems.sectionType, 'decisions'));
console.log('Decisions count:', dec.length);

console.log('\nSample wins item:', wins[0]);
console.log('\nSample exec_summary item:', exec[0]);
console.log('\nFirst 3 decisions items:');
dec.slice(0, 3).forEach((item, i) => {
  console.log(`\nDecision ${i+1}:`, JSON.stringify(item, null, 2));
});
