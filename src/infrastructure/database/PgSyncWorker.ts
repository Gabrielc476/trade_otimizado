import { Pool } from 'pg';
import { WorkerThreadDriver } from '../concurrency/WorkerThreadDriver';

interface TradeRecord {
  buyerId: number;
  sellerId: number;
  price: bigint;
  qty: bigint;
}

export class PgSyncWorker {
  private pool: Pool;
  private driver: WorkerThreadDriver;
  private tradeQueue: TradeRecord[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly maxBatchSize = 1000;
  private readonly intervalMs = 1000;
  private isFlushing = false;

  constructor(pool: Pool, driver: WorkerThreadDriver) {
    this.pool = pool;
    this.driver = driver;
  }

  public start(): void {
    // Listen to worker events
    this.driver.onMessage((msg) => {
      if (msg.type === 'TRADE') {
        this.enqueueTrade({
          buyerId: msg.buyerId,
          sellerId: msg.sellerId,
          price: BigInt(msg.price),
          qty: BigInt(msg.qty),
        });
      }
    });

    // Start periodic flush timer
    this.flushInterval = setInterval(() => {
      this.flushTrades();
    }, this.intervalMs);
  }

  public stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  private enqueueTrade(trade: TradeRecord): void {
    this.tradeQueue.push(trade);
    
    // Immediate flush if batch size exceeds maxBatchSize
    if (this.tradeQueue.length >= this.maxBatchSize) {
      this.flushTrades();
    }
  }

  public async flushTrades(): Promise<void> {
    if (this.isFlushing || this.tradeQueue.length === 0) {
      return;
    }

    this.isFlushing = true;
    const batch = this.tradeQueue;
    this.tradeQueue = [];

    const client = await this.pool.connect();
    try {
      // Build a highly optimized bulk insert query dynamically
      const values: any[] = [];
      let query = 'INSERT INTO trades (buyer_id, seller_id, price, qty) VALUES ';

      for (let i = 0; i < batch.length; i++) {
        const trade = batch[i];
        const offset = i * 4;
        query += `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
        if (i < batch.length - 1) {
          query += ', ';
        }

        values.push(trade.buyerId, trade.sellerId, trade.price.toString(), trade.qty.toString());
      }

      await client.query(query, values);
    } catch (err) {
      console.error('Failed to flush trades to PostgreSQL:', err);
      // Put back trades at the beginning of the queue to prevent data loss
      this.tradeQueue = [...batch, ...this.tradeQueue];
    } finally {
      client.release();
      this.isFlushing = false;
    }
  }

  public getQueueLength(): number {
    return this.tradeQueue.length;
  }
}
