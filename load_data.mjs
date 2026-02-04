import { readFileSync, existsSync } from 'fs';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { dashboardItems, softwareItems, systemsItems, decisions } from './drizzle/schema.js';

const DATABASE_URL = process.env.DATABASE_URL;

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

let totalItems = 0;

try {
  // Wrap all operations in a single transaction for atomicity
  await connection.beginTransaction();
  
  // Load Executive Summary (Devices) data
  if (existsSync('/tmp/parsed_data.json')) {
    const data = JSON.parse(readFileSync('/tmp/parsed_data.json', 'utf-8'));
    console.log(`Loading ${data.length} dashboard items...`);
    
    await db.delete(dashboardItems);
    
    // Batch insert instead of loop
    if (data.length > 0) {
      const values = data.map(item => ({
        sectionType: item.section,
        productCategory: item.product,
        content: item.content,
        isNew: item.is_new,
        indentLevel: item.indent_level || 0,
        order: item.order || 0
      }));
      await db.insert(dashboardItems).values(values);
    }
    
    totalItems += data.length;
    console.log(`✅ Loaded ${data.length} dashboard items`);
  }
  
  // Load Software Review data
  if (existsSync('/tmp/software_data.json')) {
    const data = JSON.parse(readFileSync('/tmp/software_data.json', 'utf-8'));
    console.log(`Loading ${data.length} software items...`);
    
    await db.delete(softwareItems);
    
    // Batch insert instead of loop
    if (data.length > 0) {
      const values = data.map(item => {
        if (item.section_type === 'decisions') {
          return {
            sectionType: item.section_type,
            content: item.topic || '',
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
          };
        } else {
          return {
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
          };
        }
      });
      await db.insert(softwareItems).values(values);
    }
    
    totalItems += data.length;
    console.log(`✅ Loaded ${data.length} software items`);
  }
  
  // Load Systems Review data
  if (existsSync('/tmp/systems_data.json')) {
    const data = JSON.parse(readFileSync('/tmp/systems_data.json', 'utf-8'));
    console.log(`Loading ${data.length} systems items...`);
    
    await db.delete(systemsItems);
    
    // Batch insert instead of loop
    if (data.length > 0) {
      const values = data.map(item => ({
        sectionType: item.section_type,
        content: item.content,
        isNew: item.is_new || 0,
        indentLevel: item.indent_level || 0,
        order: item.order || 0
      }));
      await db.insert(systemsItems).values(values);
    }
    
    totalItems += data.length;
    console.log(`✅ Loaded ${data.length} systems items`);
  }
  
  // Load Decisions data
  if (existsSync('/tmp/decisions_data.json')) {
    const data = JSON.parse(readFileSync('/tmp/decisions_data.json', 'utf-8'));
    console.log(`Loading ${data.length} decision items...`);
    
    await db.delete(decisions);
    
    // Batch insert instead of loop
    if (data.length > 0) {
      const values = data.map(item => ({
        topic: item.topic,
        dri: item.dri || '',
        forum: item.forum || '',
        status: item.status || '',
        decisionDoc: item.decision_doc || '',
        decisionMakers: item.decision_makers || '',
        decisionOutcome: item.decision_outcome || ''
      }));
      await db.insert(decisions).values(values);
    }
    
    totalItems += data.length;
    console.log(`✅ Loaded ${data.length} decision items`);
  }
  
  // Commit transaction - all or nothing
  await connection.commit();
  console.log(`\n✅ All data loaded successfully! ${totalItems} total items`);
  
} catch (error) {
  // Rollback on any error to prevent partial data
  await connection.rollback();
  console.error('❌ Transaction failed, rolled back:', error);
  throw error;
} finally {
  await connection.end();
}
