import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { dashboardItems } from './drizzle/schema.js';

const DATABASE_URL = process.env.DATABASE_URL;

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// Read parsed data
const data = JSON.parse(readFileSync('/tmp/parsed_data.json', 'utf-8'));

console.log(`Loading ${data.length} items into database...`);

// Clear existing data
await db.delete(dashboardItems);

// Insert new data
for (const item of data) {
  await db.insert(dashboardItems).values({
    sectionType: item.section,
    productCategory: item.product,
    content: item.content,
    isNew: item.is_new,
    order: 0
  });
}

console.log('Data loaded successfully!');
await connection.end();
