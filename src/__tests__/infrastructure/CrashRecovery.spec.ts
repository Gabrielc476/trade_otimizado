import * as fs from 'fs';
import * as path from 'path';
import { BinaryWALJournalAdapter } from '../../adapters/journaling/BinaryWALJournalAdapter';
import { WorkerThreadDriver } from '../../infrastructure/concurrency/WorkerThreadDriver';
import { SharedMemoryWalletReader } from '../../adapters/concurrency/SharedMemoryWalletReader';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';

const SCALE = 100000000n; // 10^8

describe('CrashRecovery', () => {
  jest.setTimeout(30000);
  const tempWalPath = path.resolve(__dirname, 'crash_recovery_wal.log');
  let driver: WorkerThreadDriver | null = null;

  afterEach(async () => {
    if (driver) {
      await driver.terminate();
      driver = null;
    }
    if (fs.existsSync(tempWalPath)) {
      fs.unlinkSync(tempWalPath);
    }
  });

  it('should restore in-memory state of Wallet and OrderBook by replaying the binary WAL on startup', async () => {
    // 1. Create a pre-populated binary WAL with deposit and matching orders
    const adapter = new BinaryWALJournalAdapter(tempWalPath);

    // Deposit 100,000 USDT to User 1 (base index 1 * 4 + 1 * 2 = 6? USDT is quote, BTC is base)
    // Assets: BTC (base), USDT (quote)
    adapter.writeDepositEntry(1, 'USDT', 100000n * SCALE);
    
    // Deposit 10 BTC to User 2
    adapter.writeDepositEntry(2, 'BTC', 10n * SCALE);

    // User 1 places BUY LIMIT order for 1 BTC at 50,000 USDT (orderId 100)
    adapter.writeEntry(100, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);

    // User 2 places SELL LIMIT order for 1 BTC at 50,000 USDT (orderId 101)
    adapter.writeEntry(101, 2, OrderSide.SELL, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);

    adapter.close();

    // 2. Spawn the WorkerThreadDriver pointing to the WAL log file
    const assets = ['BTC', 'USDT'];
    driver = new WorkerThreadDriver(assets, tempWalPath);

    // Wait for the worker to finish recovery and send 'READY'
    const workerReady = new Promise<void>((resolve) => {
      driver!.onMessage((msg) => {
        if (msg.type === 'READY') {
          resolve();
        }
      });
    });

    await workerReady;

    // 3. Read the shared memory wallet directly from the main thread
    const sab = driver.getSharedArrayBuffer();
    const reader = new SharedMemoryWalletReader(sab, assets);

    // User 1 balance should be:
    // Available USDT: 100,000 - 50,000 = 50,000
    // Available BTC: 1
    const user1USDT = reader.getBalance(1, 'USDT');
    const user1BTC = reader.getBalance(1, 'BTC');

    expect(user1USDT.available).toBe(50000n * SCALE);
    expect(user1USDT.locked).toBe(0n);
    expect(user1BTC.available).toBe(1n * SCALE);
    expect(user1BTC.locked).toBe(0n);

    // User 2 balance should be:
    // Available BTC: 10 - 1 = 9
    // Available USDT: 50,000
    const user2USDT = reader.getBalance(2, 'USDT');
    const user2BTC = reader.getBalance(2, 'BTC');

    expect(user2USDT.available).toBe(50000n * SCALE);
    expect(user2USDT.locked).toBe(0n);
    expect(user2BTC.available).toBe(9n * SCALE);
    expect(user2BTC.locked).toBe(0n);
  });
});
