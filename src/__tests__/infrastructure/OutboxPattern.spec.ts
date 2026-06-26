import { OutboxPoller } from '../../infrastructure/database/OutboxPoller';
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

describe('OutboxPattern', () => {
  let poller: OutboxPoller;
  let mockDriver: any;
  let mockJournal: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDriver = {
      sendDeposit: jest.fn(),
      sendWithdraw: jest.fn(),
    };

    mockJournal = {
      writeDepositEntry: jest.fn(),
      writeWithdrawEntry: jest.fn(),
    };

    const pool = new Pool();
    poller = new OutboxPoller(pool, mockDriver as any, mockJournal as any);
  });

  it('should create deposit transaction and outbox entry in an ACID transaction', async () => {
    mockClient.query.mockResolvedValueOnce({}); // BEGIN
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: '42' }] }); // INSERT transactions
    mockClient.query.mockResolvedValueOnce({}); // INSERT outbox
    mockClient.query.mockResolvedValueOnce({}); // COMMIT

    const txId = await poller.createDepositOrWithdrawal(1, 'BTC', 1000n, 'DEPOSIT');

    expect(txId).toBe(42);
    expect(mockClient.query).toHaveBeenCalledTimes(4);
    expect(mockClient.query.mock.calls[0][0]).toBe('BEGIN');
    expect(mockClient.query.mock.calls[1][0]).toContain('INSERT INTO transactions');
    expect(mockClient.query.mock.calls[1][1]).toEqual([1, 'BTC', '1000', 'DEPOSIT', 'PENDING']);
    expect(mockClient.query.mock.calls[2][0]).toContain('INSERT INTO outbox');
    expect(mockClient.query.mock.calls[2][1]).toEqual(['DEPOSIT', 1, 'BTC', '1000', 'PENDING']);
    expect(mockClient.query.mock.calls[3][0]).toBe('COMMIT');
  });

  it('should rollback transaction if insertion fails during creation', async () => {
    mockClient.query.mockResolvedValueOnce({}); // BEGIN
    mockClient.query.mockRejectedValueOnce(new Error('DB Connection Lost')); // INSERT transactions (fails)
    mockClient.query.mockResolvedValueOnce({}); // ROLLBACK

    await expect(
      poller.createDepositOrWithdrawal(1, 'BTC', 1000n, 'DEPOSIT')
    ).rejects.toThrow('DB Connection Lost');

    expect(mockClient.query).toHaveBeenCalledTimes(3);
    expect(mockClient.query.mock.calls[0][0]).toBe('BEGIN');
    expect(mockClient.query.mock.calls[2][0]).toBe('ROLLBACK');
  });

  it('should poll pending outbox items, write to WAL, send to worker, and mark as processed', async () => {
    mockClient.query.mockResolvedValueOnce({}); // BEGIN
    
    // Mock the pending outbox rows
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { id: 10, event_type: 'DEPOSIT', user_id: 1, asset: 'BTC', amount: '25000' },
        { id: 11, event_type: 'WITHDRAW', user_id: 2, asset: 'USDT', amount: '100000' },
      ],
    }); // SELECT FOR UPDATE SKIP LOCKED
    
    mockClient.query.mockResolvedValue({}); // UPDATE outbox status for ID 10
    mockClient.query.mockResolvedValue({}); // UPDATE transaction status for ID 10
    mockClient.query.mockResolvedValue({}); // UPDATE outbox status for ID 11
    mockClient.query.mockResolvedValue({}); // UPDATE transaction status for ID 11
    mockClient.query.mockResolvedValueOnce({}); // COMMIT

    await poller.poll();

    // Verify WAL journaling and worker thread messages
    expect(mockJournal.writeDepositEntry).toHaveBeenCalledWith(1, 'BTC', 25000n);
    expect(mockDriver.sendDeposit).toHaveBeenCalledWith(1, 'BTC', 25000n);

    expect(mockJournal.writeWithdrawEntry).toHaveBeenCalledWith(2, 'USDT', 100000n);
    expect(mockDriver.sendWithdraw).toHaveBeenCalledWith(2, 'USDT', 100000n);

    // Verify database updates and transactions
    expect(mockClient.query).toHaveBeenCalledTimes(9);
    expect(mockClient.query.mock.calls[0][0]).toBe('BEGIN');
    expect(mockClient.query.mock.calls[1][0]).toContain('SELECT id, event_type, user_id, asset, amount');
    
    // Row 10 (DEPOSIT)
    expect(mockClient.query.mock.calls[2][0]).toContain('INSERT INTO wallet_balances');
    expect(mockClient.query.mock.calls[3][0]).toBe("UPDATE outbox SET status = 'PROCESSED' WHERE id = $1");
    expect(mockClient.query.mock.calls[3][1]).toEqual([10]);
    
    // Row 11 (WITHDRAW)
    expect(mockClient.query.mock.calls[5][0]).toContain('UPDATE wallet_balances');
    expect(mockClient.query.mock.calls[6][0]).toBe("UPDATE outbox SET status = 'PROCESSED' WHERE id = $1");
    expect(mockClient.query.mock.calls[6][1]).toEqual([11]);
    
    expect(mockClient.query.mock.calls[8][0]).toBe('COMMIT');
  });
});
