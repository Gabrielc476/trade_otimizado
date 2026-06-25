import { PgSyncWorker } from '../../infrastructure/database/PgSyncWorker';
import { Pool } from 'pg';

// Mock pg Pool and Client
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn(() => Promise.resolve(mockClient)),
  query: jest.fn(),
  end: jest.fn(),
};

jest.mock('pg', () => {
  return {
    Pool: jest.fn(() => mockPool),
  };
});

describe('PgSyncWorker', () => {
  let syncWorker: PgSyncWorker;
  let mockDriver: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDriver = {
      onMessage: jest.fn(),
    };

    const pool = new Pool();
    syncWorker = new PgSyncWorker(pool, mockDriver as any);
  });

  afterEach(() => {
    syncWorker.stop();
  });

  it('should register message listener and start flush timer on start', () => {
    syncWorker.start();
    expect(mockDriver.onMessage).toHaveBeenCalled();
  });

  it('should batch incoming trade events and execute single bulk insert query on flush', async () => {
    syncWorker.start();
    
    // Simulate incoming worker messages
    const messageListener = mockDriver.onMessage.mock.calls[0][0];
    messageListener({ type: 'TRADE', buyerId: 1, sellerId: 2, price: '50000', qty: '10' });
    messageListener({ type: 'TRADE', buyerId: 3, sellerId: 4, price: '51000', qty: '20' });

    expect(syncWorker.getQueueLength()).toBe(2);

    mockClient.query.mockResolvedValueOnce({}); // Bulk Insert Query

    await syncWorker.flushTrades();

    expect(syncWorker.getQueueLength()).toBe(0);
    expect(mockPool.connect).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledTimes(1);
    
    // Check bulk query syntax
    const [query, values] = mockClient.query.mock.calls[0];
    expect(query).toContain('INSERT INTO trades (buyer_id, seller_id, price, qty) VALUES');
    expect(query).toContain('($1, $2, $3, $4), ($5, $6, $7, $8)');
    expect(values).toEqual([1, 2, '50000', '10', 3, 4, '51000', '20']);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should flush immediately when batch size reaches limit (1000)', async () => {
    syncWorker.start();
    mockClient.query.mockResolvedValue({});
    
    const messageListener = mockDriver.onMessage.mock.calls[0][0];
    
    // Enqueue 999 trades
    for (let i = 0; i < 999; i++) {
      messageListener({ type: 'TRADE', buyerId: 1, sellerId: 2, price: '50000', qty: '10' });
    }
    expect(syncWorker.getQueueLength()).toBe(999);
    expect(mockPool.connect).not.toHaveBeenCalled();

    // Enqueue 1000th trade (triggers immediate flush)
    messageListener({ type: 'TRADE', buyerId: 1, sellerId: 2, price: '50000', qty: '10' });
    
    // Allow macro-tasks/promises to resolve since flush is async
    await new Promise((resolve) => setImmediate(resolve));

    expect(syncWorker.getQueueLength()).toBe(0);
    expect(mockPool.connect).toHaveBeenCalled();
    expect(mockClient.query).toHaveBeenCalledTimes(1);
  });
});
