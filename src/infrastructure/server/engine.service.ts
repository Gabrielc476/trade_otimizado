import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PgClient } from '../database/PgClient';
import { WorkerThreadDriver } from '../concurrency/WorkerThreadDriver';
import { OutboxPoller } from '../database/OutboxPoller';
import { PgSyncWorker } from '../database/PgSyncWorker';
import { BinaryWALJournalAdapter } from '../../adapters/journaling/BinaryWALJournalAdapter';
import * as path from 'path';

@Injectable()
export class EngineService implements OnModuleInit, OnModuleDestroy {
  private pgClient: PgClient;
  private workerDriver: WorkerThreadDriver;
  private outboxPoller!: OutboxPoller;
  private syncWorker!: PgSyncWorker;
  private walPath: string;
  private walJournal: BinaryWALJournalAdapter;
  private readonly assets = ['BTC', 'USDT'];
  private eventListeners: ((message: any) => void)[] = [];

  constructor() {
    // Initialize synchronous components in constructor to prevent NestJS async initialization race conditions
    this.walPath = path.resolve(process.cwd(), 'wal.log');
    this.pgClient = new PgClient();
    this.workerDriver = new WorkerThreadDriver(this.assets, this.walPath);
    this.walJournal = new BinaryWALJournalAdapter(this.walPath);
  }

  public getPgClient(): PgClient {
    return this.pgClient;
  }

  public getWorkerDriver(): WorkerThreadDriver {
    return this.workerDriver;
  }

  public getOutboxPoller(): OutboxPoller {
    return this.outboxPoller;
  }

  async onModuleInit() {
    console.log('Initializing ApexTrade Engine Components...');

    // 1. Initialize DB (async migration runs)
    await this.pgClient.initialize();
    console.log('Database schema initialized.');

    // 2. Listen for worker messages
    this.workerDriver.onMessage((msg) => {
      // Journal worker events directly to WAL for durability on restart
      if (msg.type === 'JOURNAL_ENTRY') {
        this.walJournal.writeEntry(
          msg.orderId,
          msg.userId,
          msg.side,
          msg.orderType,
          BigInt(msg.price),
          BigInt(msg.qty)
        );
      } else if (msg.type === 'JOURNAL_CANCEL') {
        this.walJournal.writeCancelEntry(msg.orderId);
      }

      for (const listener of this.eventListeners) {
        listener(msg);
      }
    });

    // 3. Initialize Outbox Poller
    // Pass the centrally managed WAL journal to the OutboxPoller
    this.outboxPoller = new OutboxPoller(
      this.pgClient.getPool(),
      this.workerDriver,
      this.walJournal
    );
    this.outboxPoller.start(100); // Poll every 100ms
    console.log('Outbox Poller started.');

    // 4. Initialize Postgres Sync Worker (for trades history)
    this.syncWorker = new PgSyncWorker(this.pgClient.getPool(), this.workerDriver);
    this.syncWorker.start();
    console.log('Postgres Sync Worker started.');
  }

  async onModuleDestroy() {
    console.log('Stopping ApexTrade Engine Components...');
    if (this.outboxPoller) {
      this.outboxPoller.stop();
    }
    if (this.syncWorker) {
      this.syncWorker.stop();
    }
    if (this.workerDriver) {
      await this.workerDriver.terminate();
    }
    if (this.walJournal) {
      this.walJournal.close();
    }
    if (this.pgClient) {
      await this.pgClient.close();
    }
    console.log('ApexTrade Engine Components stopped gracefully.');
  }

  public onWorkerMessage(listener: (message: any) => void): void {
    this.eventListeners.push(listener);
  }
}
