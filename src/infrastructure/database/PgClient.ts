import { Pool, PoolConfig } from 'pg';

export class PgClient {
  private pool: Pool;

  constructor(config?: PoolConfig) {
    // Reuses standard environment variables (PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT)
    // if no config is explicitly provided.
    this.pool = new Pool(config || {
      max: 20, // Max connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  public getPool(): Pool {
    return this.pool;
  }

  /**
   * Initializes the database schema. Runs DDL migrations to create tables and indexes.
   */
  public async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT PRIMARY KEY,
          name VARCHAR(100) DEFAULT 'User',
          password_hash VARCHAR(255)
        );
      `);
      // Ensure column exists if table was already created
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);');

      // 2. Create wallet_balances table
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallet_balances (
          user_id INT REFERENCES users(id),
          asset VARCHAR(10),
          available BIGINT NOT NULL DEFAULT 0,
          locked BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (user_id, asset)
        );
      `);

      // 3. Create trades table (Order matches history)
      await client.query(`
        CREATE TABLE IF NOT EXISTS trades (
          id BIGSERIAL PRIMARY KEY,
          buyer_id INT REFERENCES users(id),
          seller_id INT REFERENCES users(id),
          price BIGINT NOT NULL,
          qty BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. Create orders table (Order history for query purposes)
      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id BIGINT PRIMARY KEY,
          user_id INT REFERENCES users(id),
          side VARCHAR(4) NOT NULL,
          type VARCHAR(6) NOT NULL,
          price BIGINT NOT NULL,
          qty BIGINT NOT NULL,
          status VARCHAR(20) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Create transactions table (Deposit/Withdraw transactional record)
      await client.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id BIGSERIAL PRIMARY KEY,
          user_id INT REFERENCES users(id),
          asset VARCHAR(10) NOT NULL,
          amount BIGINT NOT NULL,
          type VARCHAR(10) NOT NULL, -- 'DEPOSIT' or 'WITHDRAW'
          status VARCHAR(20) NOT NULL, -- 'PENDING' or 'COMPLETED' or 'FAILED'
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Create outbox table (Outbox pattern for balance event publishing)
      await client.query(`
        CREATE TABLE IF NOT EXISTS outbox (
          id BIGSERIAL PRIMARY KEY,
          event_type VARCHAR(10) NOT NULL, -- 'DEPOSIT' or 'WITHDRAW'
          user_id INT REFERENCES users(id),
          asset VARCHAR(10) NOT NULL,
          amount BIGINT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING' or 'PROCESSED'
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes to optimize queries and avoid full table scans on hot foreign keys
      await client.query('CREATE INDEX IF NOT EXISTS idx_trades_buyer ON trades(buyer_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_trades_seller ON trades(seller_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);');
      await client.query('CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status) WHERE status = \'PENDING\';');

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
