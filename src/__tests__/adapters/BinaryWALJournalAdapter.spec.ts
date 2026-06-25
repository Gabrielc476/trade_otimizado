import * as fs from 'fs';
import * as path from 'path';
import { BinaryWALJournalAdapter } from '../../adapters/journaling/BinaryWALJournalAdapter';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';

describe('BinaryWALJournalAdapter', () => {
  const tempWalPath = path.resolve(__dirname, 'temp_wal.log');

  afterEach(() => {
    if (fs.existsSync(tempWalPath)) {
      fs.unlinkSync(tempWalPath);
    }
  });

  it('should write and read back multiple types of events with exact 33-byte structure', () => {
    const adapter = new BinaryWALJournalAdapter(tempWalPath);

    // 1. Write PLACE_ORDER
    adapter.writeEntry(101.5, 1, OrderSide.BUY, OrderType.LIMIT, 50000n, 1000n);

    // 2. Write CANCEL_ORDER
    adapter.writeCancelEntry(101.5);

    // 3. Write DEPOSIT
    adapter.writeDepositEntry(2, 'BTC', 250000n);

    // 4. Write WITHDRAW
    adapter.writeWithdrawEntry(3, 'USDT', 1500000n);

    adapter.close();

    // Verify the file size is exactly 33 * 4 = 132 bytes
    const stats = fs.statSync(tempWalPath);
    expect(stats.size).toBe(132);

    // Read back all events
    const events = BinaryWALJournalAdapter.readWAL(tempWalPath);
    expect(events.length).toBe(4);

    // Verify event 1: PLACE_ORDER
    expect(events[0]).toEqual({
      type: 'PLACE_ORDER',
      orderId: 101.5,
      userId: 1,
      side: OrderSide.BUY,
      orderType: OrderType.LIMIT,
      price: 50000n,
      qty: 1000n,
    });

    // Verify event 2: CANCEL_ORDER
    expect(events[1]).toEqual({
      type: 'CANCEL_ORDER',
      orderId: 101.5,
    });

    // Verify event 3: DEPOSIT
    expect(events[2]).toEqual({
      type: 'DEPOSIT',
      userId: 2,
      asset: 'BTC',
      amount: 250000n,
    });

    // Verify event 4: WITHDRAW
    expect(events[3]).toEqual({
      type: 'WITHDRAW',
      userId: 3,
      asset: 'USDT',
      amount: 1500000n,
    });
  });

  it('should return empty array if WAL file does not exist', () => {
    const events = BinaryWALJournalAdapter.readWAL('non_existent_file.log');
    expect(events).toEqual([]);
  });
});
