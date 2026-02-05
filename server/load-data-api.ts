import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { dashboardItems, softwareItems, systemsItems, decisions } from '../drizzle/schema';

export async function loadDataFromAPI(data: {
  devices?: any[];
  software?: any[];
  systems?: any[];
  decisions?: any[];
}) {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }

  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  let totalItems = 0;

  try {
    // Wrap all operations in a single transaction for atomicity
    await connection.beginTransaction();

    // Load Executive Summary (Devices) data
    if (data.devices && data.devices.length > 0) {
      console.log(`[LOAD_API] Loading ${data.devices.length} dashboard items...`);
      
      await db.delete(dashboardItems);
      
      const values = data.devices.map(item => ({
        sectionType: item.section,
        productCategory: item.product_category || item.product,
        content: item.content,
        isNew: item.is_new,
        indentLevel: item.indent_level || 0,
        order: item.order || 0
      }));
      await db.insert(dashboardItems).values(values);
      
      totalItems += data.devices.length;
      console.log(`[LOAD_API] ✅ Loaded ${data.devices.length} dashboard items`);
    }

    // Load Software Review data
    if (data.software && data.software.length > 0) {
      console.log(`[LOAD_API] Loading ${data.software.length} software items...`);
      
      await db.delete(softwareItems);
      
      const values = data.software.map(item => {
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
      
      totalItems += data.software.length;
      console.log(`[LOAD_API] ✅ Loaded ${data.software.length} software items`);
    }

    // Load Systems Review data
    if (data.systems && data.systems.length > 0) {
      console.log(`[LOAD_API] Loading ${data.systems.length} systems items...`);
      
      await db.delete(systemsItems);
      
      const values = data.systems.map(item => ({
        sectionType: item.section_type,
        content: item.content,
        isNew: item.is_new || 0,
        indentLevel: item.indent_level || 0,
        order: item.order || 0
      }));
      await db.insert(systemsItems).values(values);
      
      totalItems += data.systems.length;
      console.log(`[LOAD_API] ✅ Loaded ${data.systems.length} systems items`);
    }

    // Load Decisions data
    if (data.decisions && data.decisions.length > 0) {
      console.log(`[LOAD_API] Loading ${data.decisions.length} decision items...`);
      
      await db.delete(decisions);
      
      const values = data.decisions.map(item => ({
        week: item.week || '',
        dri: item.dri || '',
        forum: item.forum || '',
        status: item.status || '',
        decisionOutcome: item.decision_outcome || ''
      }));
      await db.insert(decisions).values(values);
      
      totalItems += data.decisions.length;
      console.log(`[LOAD_API] ✅ Loaded ${data.decisions.length} decision items`);
    }

    // Commit transaction - all or nothing
    await connection.commit();
    console.log(`[LOAD_API] ✅ All data loaded successfully! ${totalItems} total items`);

    return { success: true, totalItems };
    
  } catch (error) {
    // Rollback on any error to prevent partial data
    await connection.rollback();
    console.error('[LOAD_API] ❌ Transaction failed, rolled back:', error);
    throw error;
  } finally {
    await connection.end();
  }
}
