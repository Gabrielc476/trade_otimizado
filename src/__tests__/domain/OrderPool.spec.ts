import { OrderPool } from '../../domain/entities/OrderPool';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';

describe('OrderPool', () => {
  it('should acquire and release orders correctly', () => {
    const pool = new OrderPool(10);
    expect(pool.getAvailableCount()).toBe(10);

    const order1 = pool.acquire(1, 100, 'BTC/USDT', OrderSide.BUY, OrderType.LIMIT, 50000n, 2n);
    expect(pool.getAvailableCount()).toBe(9);
    expect(order1.id).toBe(1);
    expect(order1.userId).toBe(100);
    expect(order1.symbol).toBe('BTC/USDT');
    expect(order1.side).toBe(OrderSide.BUY);
    expect(order1.type).toBe(OrderType.LIMIT);
    expect(order1.price).toBe(50000n);
    expect(order1.qty).toBe(2n);
    expect(order1.filledQty).toBe(0n);

    pool.release(order1);
    expect(pool.getAvailableCount()).toBe(10);

    // Re-acquiring should reuse the same slot and clean the state
    const order2 = pool.acquire(2, 200, 'ETH/USDT', OrderSide.SELL, OrderType.MARKET, 3000n, 5n);
    expect(order2.id).toBe(2);
    expect(order2.userId).toBe(200);
    expect(order2.symbol).toBe('ETH/USDT');
    expect(order2.side).toBe(OrderSide.SELL);
    expect(order2.type).toBe(OrderType.MARKET);
    expect(order2.price).toBe(3000n);
    expect(order2.qty).toBe(5n);
  });

  it('should grow dynamically if pool is exhausted', () => {
    const pool = new OrderPool(2);
    expect(pool.getAvailableCount()).toBe(2);

    const order1 = pool.acquire(1, 100, 'BTC/USDT', OrderSide.BUY, OrderType.LIMIT, 50000n, 2n);
    const order2 = pool.acquire(2, 100, 'BTC/USDT', OrderSide.BUY, OrderType.LIMIT, 50000n, 2n);
    expect(pool.getAvailableCount()).toBe(0);

    // This should grow the pool dynamically
    const order3 = pool.acquire(3, 100, 'BTC/USDT', OrderSide.BUY, OrderType.LIMIT, 50000n, 2n);
    expect(order3.id).toBe(3);
    expect(pool.getAvailableCount()).toBe(0);

    // Releasing them should return them to the pool up to the pool limit
    pool.release(order1);
    pool.release(order2);
    expect(pool.getAvailableCount()).toBe(2);

    // If we release the dynamically allocated one, it won't overflow the pool array because of capacity checks
    pool.release(order3);
    expect(pool.getAvailableCount()).toBe(2);
  });
});
