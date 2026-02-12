import fs from 'fs';
import { getDb } from './db.ts';
import { aiItems } from '../drizzle/schema.ts';

async function loadAiData() {
  const data = JSON.parse(fs.readFileSync('/tmp/ai_data.json', 'utf8'));
  const db = await getDb();
  
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }
  
  // Clear existing AI items
  await db.delete(aiItems);
  
  // Insert new items
  console.log(`Loading ${data.items.length} AI items...`);
  for (const item of data.items) {
    await db.insert(aiItems).values({
      sectionType: item.section_type,
      content: item.content,
      isNew: item.is_new ? 1 : 0,
      indentLevel: item.indent_level,
      order: item.order,
      // Decision table fields (only for decisions section)
      dri: item.dri || null,
      forum: item.forum || null,
      status: item.status || null,
      decisionDoc: item.decision_doc || null,
      decisionMakers: item.decision_makers || null,
      post: item.post || null
    });
  }
  
  console.log('✅ AI data loaded successfully!');
  process.exit(0);
}

loadAiData().catch(err => {
  console.error('Error loading AI data:', err);
  process.exit(1);
});
