import { drizzle } from 'drizzle-orm/mysql2';
import { milestones } from './drizzle/schema.ts';
import fs from 'fs';

const db = drizzle(process.env.DATABASE_URL);

// Read milestone data
const data = JSON.parse(fs.readFileSync('/home/ubuntu/milestones_data.json', 'utf8'));

// Clear existing data
await db.delete(milestones);

// Insert milestones
let insertCount = 0;
for (const [milestoneType, items] of Object.entries(data)) {
  for (const item of items) {
    await db.insert(milestones).values({
      product: item.product,
      milestoneName: item.name,
      milestoneDate: new Date(item.date),
      milestoneType: milestoneType,
      originalType: item.type || ''
    });
    insertCount++;
  }
}

console.log(`Successfully inserted ${insertCount} milestones`);
console.log(`  - PDP Gates: ${data.pdp_gates.length}`);
console.log(`  - SW Milestones: ${data.sw_milestones.length}`);
console.log(`  - HW Dates: ${data.hw_dates.length}`);
process.exit(0);
