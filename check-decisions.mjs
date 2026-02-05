import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [results] = await connection.query('SELECT id, week, dri, forum FROM decisions LIMIT 5');
console.log(JSON.stringify(results, null, 2));
await connection.end();
