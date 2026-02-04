#!/usr/bin/env node
/**
 * Load upcoming reviews data from JSON into database
 */

import mysql from 'mysql2/promise';
import fs from 'fs';

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);

  // Read parsed data
  const data = JSON.parse(fs.readFileSync('/tmp/upcoming_reviews_data.json', 'utf-8'));

  console.log(`Loading ${data.length} upcoming reviews into database...`);

  // Clear existing data
  await connection.query('DELETE FROM upcoming_reviews');

  // Insert new data
  if (data.length > 0) {
    const values = data.map(review => [
      review.review_type,
      review.week,
      review.date,
      review.topic,
      review.description || '',
      review.owner || 'TBD'
    ]);

    const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const flatValues = values.flat();

    await connection.query(
      `INSERT INTO upcoming_reviews (review_type, week, date, topic, description, owner) VALUES ${placeholders}`,
      flatValues
    );
  }

  console.log('Upcoming reviews data loaded successfully!');
  await connection.end();
}

main().catch(err => {
  console.error('Error loading upcoming reviews:', err);
  process.exit(1);
});
