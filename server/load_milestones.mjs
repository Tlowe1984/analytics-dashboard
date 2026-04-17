import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { milestones } from '../drizzle/schema.js';
import fs from 'fs';

const rawDbUrl = (process.env.DATABASE_URL || '');
const isLocal = rawDbUrl.includes('localhost') || rawDbUrl.includes('127.0.0.1');
const dbUrl = rawDbUrl.replace(/[?&]ssl=[^&]*/g, '').replace(/\?$/, '').replace(/\?&/, '?');
const connection = await mysql.createConnection({ uri: dbUrl, ...(isLocal ? {} : { ssl: { rejectUnauthorized: true } }) });
const db = drizzle(connection);

try {
  // Read parsed milestones
  const data = JSON.parse(fs.readFileSync('/tmp/milestones_parsed.json', 'utf8'));
  console.log(`Loading ${data.length} milestones...`);
  
  // Wrap in transaction for atomicity
  await connection.beginTransaction();
  
  // Clear existing milestones
  await db.delete(milestones);
  console.log('Cleared existing milestones');
  
  // Batch insert new milestones
  if (data.length > 0) {
    const values = data.map(item => ({
      product: item.product,
      milestoneName: item.milestone_name,
      milestoneDate: new Date(item.milestone_date),
      milestoneType: item.milestone_type,
      originalType: item.original_type || ''
    }));
    
    await db.insert(milestones).values(values);
  }
  
  // Commit transaction
  await connection.commit();
  console.log(`✅ Successfully loaded ${data.length} milestones`);
  
} catch (error) {
  // Rollback on error
  await connection.rollback();
  console.error('❌ Transaction failed, rolled back:', error);
  process.exit(1);
} finally {
  await connection.end();
}

process.exit(0);
