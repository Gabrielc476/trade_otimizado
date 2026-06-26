import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const client = new Client({
    host: process.env.PGHOST || '127.0.0.1',
    port: parseInt(process.env.PGPORT || '5433', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'postgres',
  });

  await client.connect();
  console.log("Conectado ao banco de dados!");

  const users = await client.query("SELECT * FROM users;");
  console.log("\n=== USERS ===");
  console.table(users.rows);

  const outbox = await client.query("SELECT * FROM outbox;");
  console.log("\n=== OUTBOX ===");
  console.table(outbox.rows);

  const balances = await client.query("SELECT * FROM wallet_balances;");
  console.log("\n=== WALLET BALANCES ===");
  console.table(balances.rows);

  const transactions = await client.query("SELECT * FROM transactions;");
  console.log("\n=== TRANSACTIONS ===");
  console.table(transactions.rows);

  const trades = await client.query("SELECT * FROM trades;");
  console.log("\n=== TRADES ===");
  console.table(trades.rows);

  await client.end();
}

run().catch(console.error);
