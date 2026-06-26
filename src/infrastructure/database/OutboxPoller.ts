import { Pool } from 'pg';
import { WorkerThreadDriver } from '../concurrency/WorkerThreadDriver';
import { JournalingPort } from '../../application/ports/JournalingPort';

export class OutboxPoller {
  private pool: Pool;
  private driver: WorkerThreadDriver;
  private walJournal: JournalingPort;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private readonly batchSize = 100;

  constructor(pool: Pool, driver: WorkerThreadDriver, walJournal: JournalingPort) {
    this.pool = pool;
    this.driver = driver;
    this.walJournal = walJournal;
  }

  public start(intervalMs = 100): void {
    this.pollingInterval = setInterval(async () => {
      await this.poll();
    }, intervalMs);
  }

  public stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Polls the outbox table for pending deposit/withdrawal events,
   * journals them to the WAL, dispatches them to the engine thread,
   * and updates their status atomically.
   */
  public async poll(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Fetch pending events with SELECT FOR UPDATE SKIP LOCKED to prevent race conditions and scaling locks
      const res = await client.query(
        `SELECT id, event_type, user_id, asset, amount 
         FROM outbox 
         WHERE status = 'PENDING' 
         ORDER BY id ASC 
         LIMIT $1 
         FOR UPDATE SKIP LOCKED`,
        [this.batchSize]
      );

      for (const row of res.rows) {
        const { id, event_type, user_id, asset, amount } = row;
        const amountBigInt = BigInt(amount);

        // 1. Write event to WAL physical file and dispatch to the worker thread
        if (event_type === 'DEPOSIT') {
          this.walJournal.writeDepositEntry(user_id, asset, amountBigInt);
          this.driver.sendDeposit(user_id, asset, amountBigInt);
        } else if (event_type === 'WITHDRAW') {
          this.walJournal.writeWithdrawEntry(user_id, asset, amountBigInt);
          this.driver.sendWithdraw(user_id, asset, amountBigInt);
        }

        // 2. Update wallet_balances in the DB
        if (event_type === 'DEPOSIT') {
          await client.query(`
            INSERT INTO wallet_balances (user_id, asset, available, locked)
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (user_id, asset)
            DO UPDATE SET available = wallet_balances.available + EXCLUDED.available
          `, [user_id, asset, amount]);
        } else if (event_type === 'WITHDRAW') {
          await client.query(`
            UPDATE wallet_balances
            SET available = available - $3
            WHERE user_id = $1 AND asset = $2
          `, [user_id, asset, amount]);
        }

        // 3. Mark outbox event as PROCESSED in the DB
        await client.query("UPDATE outbox SET status = 'PROCESSED' WHERE id = $1", [id]);

        // 4. Mark the corresponding transaction as COMPLETED in the DB
        // We match by user_id, asset, amount, and type for simplicity of this flow
        await client.query(
          `UPDATE transactions 
           SET status = 'COMPLETED' 
           WHERE user_id = $1 AND asset = $2 AND amount = $3 AND type = $4 AND status = 'PENDING'`,
          [user_id, asset, amount, event_type]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error in OutboxPoller execution:', err);
    } finally {
      client.release();
      this.isPolling = false;
    }
  }

  /**
   * Transactionally creates a balance adjustment (deposit or withdraw) in the database,
   * writing to both the transactions and outbox tables in an ACID manner.
   */
  public async createDepositOrWithdrawal(
    userId: number,
    asset: string,
    amount: bigint,
    type: 'DEPOSIT' | 'WITHDRAW'
  ): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert transactional history record
      const txRes = await client.query(
        'INSERT INTO transactions (user_id, asset, amount, type, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [userId, asset, amount.toString(), type, 'PENDING']
      );
      const txId = parseInt(txRes.rows[0].id, 10);

      // 2. Insert outbox event
      await client.query(
        'INSERT INTO outbox (event_type, user_id, asset, amount, status) VALUES ($1, $2, $3, $4, $5)',
        [type, userId, asset, amount.toString(), 'PENDING']
      );

      await client.query('COMMIT');
      return txId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
