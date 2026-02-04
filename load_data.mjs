import { readFileSync, existsSync } from 'fs';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { dashboardItems, softwareItems, systemsItems, decisions } from './drizzle/schema.js';

const DATABASE_URL = process.env.DATABASE_URL;

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

let totalItems = 0;

// Load Executive Summary (Devices) data
if (existsSync('/tmp/parsed_data.json')) {
  const data = JSON.parse(readFileSync('/tmp/parsed_data.json', 'utf-8'));
  console.log(`Loading ${data.length} dashboard items...`);
  
  await db.delete(dashboardItems);
  
  for (const item of data) {
    await db.insert(dashboardItems).values({
      sectionType: item.section,
      productCategory: item.product,
      content: item.content,
      isNew: item.is_new,
      indentLevel: item.indent_level || 0,
      order: item.order || 0
    });
  }
  
  totalItems += data.length;
  console.log(`✅ Loaded ${data.length} dashboard items`);
}

// Load Software Review data
if (existsSync('/tmp/software_data.json')) {
  const data = JSON.parse(readFileSync('/tmp/software_data.json', 'utf-8'));
  console.log(`Loading ${data.length} software items...`);
  
  await db.delete(softwareItems);
  
  for (const item of data) {
    if (item.section_type === 'decisions') {
      // Insert decision with all fields
      await db.insert(softwareItems).values({
        sectionType: item.section_type,
        content: item.topic || '',  // Use topic as content for decisions
        isNew: 0,
        indentLevel: 0,
        order: item.order || 0,
        category: item.category || null,
        topic: item.topic || null,
        dri: item.dri || null,
        forum: item.forum || null,
        status: item.status || null,
        decisionDoc: item.decision_doc || null,
        decisionMakers: item.decision_makers || null,
        decisionOutcome: item.decision_outcome || null,
        post: item.post || null
      });
    } else {
      // Insert wins or exec_summary
      await db.insert(softwareItems).values({
        sectionType: item.section_type,
        content: item.content,
        isNew: item.is_new || 0,
        indentLevel: item.indent_level || 0,
        order: item.order || 0,
        category: null,
        topic: null,
        dri: null,
        forum: null,
        status: null,
        decisionDoc: null,
        decisionMakers: null,
        decisionOutcome: null,
        post: null
      });
    }
  }
  
  totalItems += data.length;
  console.log(`✅ Loaded ${data.length} software items`);
}

// Load Systems Review data
if (existsSync('/tmp/systems_data.json')) {
  const data = JSON.parse(readFileSync('/tmp/systems_data.json', 'utf-8'));
  console.log(`Loading ${data.length} systems items...`);
  
  await db.delete(systemsItems);
  
  for (const item of data) {
    await db.insert(systemsItems).values({
      sectionType: item.section_type,
      content: item.content,
      isNew: item.is_new || 0,
      indentLevel: item.indent_level || 0,
      order: item.order || 0
    });
  }
  
  totalItems += data.length;
  console.log(`✅ Loaded ${data.length} systems items`);
}

// Load Decisions data
if (existsSync('/tmp/decisions_data.json')) {
  const data = JSON.parse(readFileSync('/tmp/decisions_data.json', 'utf-8'));
  console.log(`Loading ${data.length} decision items...`);
  
  await db.delete(decisions);
  
  for (const item of data) {
    await db.insert(decisions).values({
      topic: item.topic,
      dri: item.dri || '',
      forum: item.forum || '',
      status: item.status || '',
      decisionDoc: item.decision_doc || '',
      decisionMakers: item.decision_makers || '',
      decisionOutcome: item.decision_outcome || ''
    });
  }
  
  totalItems += data.length;
  console.log(`✅ Loaded ${data.length} decision items`);
}

console.log(`\n✅ All data loaded successfully! ${totalItems} total items`);
await connection.end();
