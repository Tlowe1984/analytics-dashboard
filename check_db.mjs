import { getAllDashboardItems } from './server/db.ts';
const items = await getAllDashboardItems();
const counts = {};
for (const item of items) {
  const key = `${item.productCategory}|${item.sectionType}`;
  counts[key] = (counts[key] || 0) + 1;
}
console.log('Total items:', items.length);
for (const [k, v] of Object.entries(counts).sort()) {
  const [p, s] = k.split('|');
  console.log(`  ${p.padEnd(15)} ${s.padEnd(12)} -> ${v}`);
}
process.exit(0);
