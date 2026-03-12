import { readFileSync } from 'fs';
import { getDb } from './server/db.js';
import { softwareItems } from './drizzle/schema.js';

const sections = JSON.parse(readFileSync('/tmp/software_data.json', 'utf8'));
const db = await getDb();

if (!db) {
  console.error('Failed to connect to database');
  process.exit(1);
}

// Map section names to database categories
const categoryMap = {
  'Experiences & Interfaces': 'software_ie',
  'AI': 'software_ai',
  'Hearing': 'software_hearing'
};

// Clear existing data
await db.delete(softwareItems);

let totalInserted = 0;

// Process each section
for (const section of sections) {
  const sectionName = section.section;
  const dbCategory = categoryMap[sectionName];
  
  if (!dbCategory) {
    console.error(`Unknown section: ${sectionName}`);
    continue;
  }
  
  // Insert wins
  for (let idx = 0; idx < section.wins.length; idx++) {
    const item = section.wins[idx];
    // Parser now returns objects with {content, is_wearables_tag}
    const content = item.content;
    const isWearablesTag = item.is_wearables_tag || 0;
    await db.insert(softwareItems).values({
      softwareCategory: dbCategory,
      sectionType: 'wins',
      content,
      isNew: 0,
      isWearablesTag,
      indentLevel: 0,
      order: idx,
    });
    totalInserted++;
  }
  
  // Insert exec summary
  for (let idx = 0; idx < section.exec_summary.length; idx++) {
    const item = section.exec_summary[idx];
    const content = item.content;
    const isWearablesTag = item.is_wearables_tag || 0;
    await db.insert(softwareItems).values({
      softwareCategory: dbCategory,
      sectionType: 'exec_summary',
      content,
      isNew: 0,
      isWearablesTag,
      indentLevel: 0,
      order: idx,
    });
    totalInserted++;
  }
  
  // Insert help_needed
  for (let idx = 0; idx < section.help_needed.length; idx++) {
    const item = section.help_needed[idx];
    const content = item.content;
    const isWearablesTag = item.is_wearables_tag || 0;
    await db.insert(softwareItems).values({
      softwareCategory: dbCategory,
      sectionType: 'help_needed',
      content,
      isNew: 0,
      isWearablesTag,
      indentLevel: 0,
      order: idx,
    });
    totalInserted++;
  }
  
  // Insert structured decisions
  for (let idx = 0; idx < section.structured_decisions.length; idx++) {
    const decision = section.structured_decisions[idx];
    const decisionText = `${decision.topic || ''} ${decision.decision_outcome || ''}`;
    const isWearablesTag = decisionText.includes('[wearables-tag]') ? 1 : 0;
    await db.insert(softwareItems).values({
      softwareCategory: dbCategory,
      sectionType: 'decisions',
      content: '',
      topic: decision.topic || '',
      dri: decision.dri || '',
      forum: decision.forum || '',
      status: decision.status || '',
      decisionDoc: decision.decision_doc || '',
      decisionMakers: decision.decision_makers || '',
      decisionOutcome: decision.decision_outcome || '',
      post: decision.post || '',
      isNew: 0,
      isWearablesTag,
      indentLevel: 0,
      order: idx,
    });
    totalInserted++;
  }
  
  // Insert hotspots (only for Experiences & Interfaces section)
  // Hotspots are risks/opens, so use exec_summary section type
  if (section.hotspots && section.hotspots.length > 0) {
    for (let idx = 0; idx < section.hotspots.length; idx++) {
      const hotspot = section.hotspots[idx];
      await db.insert(softwareItems).values({
        softwareCategory: dbCategory,
        sectionType: 'exec_summary',  // Hotspots are risks, use exec_summary type
        content: hotspot,
        isNew: 0,
        isWearablesTag: 1,  // All hotspots are wearables-tagged by definition
        indentLevel: 0,
        order: section.exec_summary.length + idx,  // Append after existing exec_summary items
      });
      totalInserted++;
    }
  }
  
  console.log(`Synced ${sectionName}: ${section.wins.length} wins, ${section.exec_summary.length} exec items, ${section.help_needed.length} help needed, ${section.structured_decisions.length} decisions`);
}

console.log(`✅ Loaded ${totalInserted} Software items total`);
process.exit(0);
