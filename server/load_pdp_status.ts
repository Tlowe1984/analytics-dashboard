#!/usr/bin/env node
/**
 * load_pdp_status.ts
 * Loads parsed PDP Status JSON into the database.
 * Usage: pnpm exec tsx server/load_pdp_status.ts <json_file>
 */
import fs from 'fs';
import { clearPdpStatus, insertPdpStatusRows } from './db';

interface PdpRow {
  pdp_gate: string;
  status_plan: string;
  critical_topics: string;
  link_text: string;
  link_url: string;
  sort_order: number;
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error('Usage: pnpm exec tsx server/load_pdp_status.ts <json_file>');
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const rows: PdpRow[] = JSON.parse(raw);

  if (!rows || rows.length === 0) {
    console.error('No PDP status rows found in JSON');
    process.exit(1);
  }

  console.log(`Loading ${rows.length} PDP status rows...`);

  await clearPdpStatus();
  await insertPdpStatusRows(
    rows.map((row) => ({
      pdpGate: row.pdp_gate,
      statusPlan: row.status_plan || null,
      criticalTopics: row.critical_topics || null,
      linkText: row.link_text || null,
      linkUrl: row.link_url || null,
      sortOrder: row.sort_order,
    }))
  );

  console.log(`Successfully loaded ${rows.length} PDP status rows`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Error loading PDP status:', e);
  process.exit(1);
});
