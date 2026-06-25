import { WorkerThreadDriver } from '../../infrastructure/concurrency/WorkerThreadDriver';
import { SharedMemoryWalletReader } from '../../adapters/concurrency/SharedMemoryWalletReader';
import { Wallet } from '../../domain/entities/Wallet';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';
import { SCALE } from '../../domain/entities/MatchingEngine';

describe('WorkerConcurrency', () => {
  jest.setTimeout(30000);
  let driver: WorkerThreadDriver;
  let reader: SharedMemoryWalletReader;
  let mainWallet: Wallet;
  const assets = ['BTC', 'USDT'];

  beforeEach((done) => {
    driver = new WorkerThreadDriver(assets);
    const sab = driver.getSharedArrayBuffer();
    reader = new SharedMemoryWalletReader(sab, assets);
    mainWallet = new Wallet(sab, assets);

    const handleReady = (msg: any) => {
      if (msg.type === 'READY') {
        done();
      }
    };
    driver.onMessage(handleReady);
  });

  afterEach(async () => {
    if (driver) {
      await driver.terminate();
    }
  });

  it('should initialize and process a ping-pong match correctly', (done) => {
    // Credit balances via main thread writing to SAB
    mainWallet.credit(1, 'USDT', 100000n * SCALE);
    mainWallet.credit(2, 'BTC', 10n * SCALE);

    expect(reader.getBalance(1, 'USDT').available).toBe(100000n * SCALE);
    expect(reader.getBalance(2, 'BTC').available).toBe(10n * SCALE);

    const receivedMessages: any[] = [];
    driver.onMessage((msg) => {
      receivedMessages.push(msg);

      if (receivedMessages.filter(m => m.type === 'TRADE').length > 0) {
        // Verify real-time balance changes in SharedArrayBuffer
        const buyerBTC = reader.getBalance(1, 'BTC');
        const buyerUSDT = reader.getBalance(1, 'USDT');
        const sellerBTC = reader.getBalance(2, 'BTC');
        const sellerUSDT = reader.getBalance(2, 'USDT');

        expect(buyerBTC.available).toBe(1n * SCALE);
        expect(buyerUSDT.available).toBe(50000n * SCALE);
        expect(sellerBTC.available).toBe(9n * SCALE);
        expect(sellerUSDT.available).toBe(50000n * SCALE);

        done();
      }
    });

    // Buy 1 BTC at 50,000 USDT
    driver.sendOrder(1, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);
    // Sell 1 BTC at 50,000 USDT
    driver.sendOrder(2, 2, OrderSide.SELL, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);
  });

  it('should prevent double spending and maintain integrity under concurrent orders', (done) => {
    // User 1 has 60,000 USDT
    // User 2 has 2 BTC
    mainWallet.credit(1, 'USDT', 60000n * SCALE);
    mainWallet.credit(2, 'BTC', 2n * SCALE);

    let tradesCount = 0;

    driver.onMessage((msg) => {
      if (msg.type === 'TRADE') {
        tradesCount++;
      }
      
      // Wait a short delay to ensure processing completes
      setTimeout(() => {
        // Only 1 trade should succeed because User 1 lacks funds for the second
        expect(tradesCount).toBe(1);
        
        // Check final balances
        expect(reader.getBalance(1, 'USDT').available).toBe(10000n * SCALE);
        expect(reader.getBalance(1, 'BTC').available).toBe(1n * SCALE);
        
        done();
      }, 200);
    });

    // Send first buy order (succeeds, costs 50,000 USDT)
    driver.sendOrder(1, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);
    // Send second buy order (fails in worker because only 10,000 USDT is available)
    driver.sendOrder(2, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);
    // Send matching sell order
    driver.sendOrder(3, 2, OrderSide.SELL, OrderType.LIMIT, 50000n * SCALE, 2n * SCALE);
  });
});
