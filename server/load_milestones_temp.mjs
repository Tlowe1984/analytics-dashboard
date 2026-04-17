import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { milestones } from '../drizzle/schema.js';
import fs from 'fs';

const rawDbUrl = (process.env.DATABASE_URL || '');
const isLocal = rawDbUrl.includes('localhost') || rawDbUrl.includes('127.0.0.1');
const dbUrl = rawDbUrl.replace(/[?&]ssl=[^&]*/g, '').replace(/\?$/, '').replace(/\?&/, '?');
const connection = await mysql.createConnection({ uri: dbUrl, ...(isLocal ? {} : { ssl: { rejectUnauthorized: true } }) });
const db = drizzle(connection);

// Read parsed milestones
const data = JSON.parse(fs.readFileSync('/tmp/milestones_parsed.json', 'utf8'));

// Clear existing milestones
await db.delete(milestones);
console.log('Cleared existing milestones');

// Insert new milestones
let insertCount = 0;
for (const item of data) {
  try {
    await db.insert(milestones).values({
      product: item.product,
      milestoneName: item.milestone_name,
      milestoneDate: new Date(item.milestone_date),
      milestoneType: item.milestone_type,
      originalType: item.original_type || ''
    });
    insertCount++;
  } catch (err) {
    console.error(`Failed to insert milestone: ${item.product} - ${item.milestone_name}`, err.message);
  }
}

console.log(`Successfully inserted ${insertCount} milestones`);
await connection.end();
process.exit(0);
