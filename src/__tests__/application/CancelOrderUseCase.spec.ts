import { Wallet } from '../../domain/entities/Wallet';
import { OrderPool } from '../../domain/entities/OrderPool';
import { MatchingEngine, SCALE } from '../../domain/entities/MatchingEngine';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';
import { ErrorCode } from '../../domain/enums/ErrorCode';
import { JournalingPort } from '../../application/ports/JournalingPort';
import { EventPublisherPort } from '../../application/ports/EventPublisherPort';
import { PlaceOrderUseCase } from '../../application/usecases/PlaceOrderUseCase';
import { CancelOrderUseCase } from '../../application/usecases/CancelOrderUseCase';

class MockJournalingPort implements JournalingPort {
  public entries: any[] = [];
  public cancelEntries: number[] = [];

  writeEntry(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): void {
    this.entries.push({ orderId, userId, side, type, price, qty });
  }

  writeCancelEntry(orderId: number): void {
    this.cancelEntries.push(orderId);
  }
}

class MockEventPublisherPort implements EventPublisherPort {
  public trades: any[] = [];
  public placements: any[] = [];
  public cancellations: any[] = [];

  publishTrade(buyerId: number, sellerId: number, price: bigint, qty: bigint): void {
    this.trades.push({ buyerId, sellerId, price, qty });
  }

  publishOrderPlaced(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): void {
    this.placements.push({ orderId, userId, side, type, price, qty });
  }

  publishOrderCancelled(
    orderId: number,
    userId: number,
    price: bigint,
    qty: bigint,
    side: OrderSide
  ): void {
    this.cancellations.push({ orderId, userId, price, qty, side });
  }
}

describe('CancelOrderUseCase', () => {
  let wallet: Wallet;
  let pool: OrderPool;
  let engine: MatchingEngine;
  let journalingPort: MockJournalingPort;
  let eventPublisherPort: MockEventPublisherPort;
  let placeUseCase: PlaceOrderUseCase;
  let cancelUseCase: CancelOrderUseCase;

  beforeEach(() => {
    wallet = new Wallet();
    pool = new OrderPool(100);
    engine = new MatchingEngine('BTC/USDT', 'BTC', 'USDT', wallet, pool);
    journalingPort = new MockJournalingPort();
    eventPublisherPort = new MockEventPublisherPort();
    placeUseCase = new PlaceOrderUseCase(engine, journalingPort, eventPublisherPort);
    cancelUseCase = new CancelOrderUseCase(engine, journalingPort, eventPublisherPort);

    // Provide initial funds
    wallet.credit(1, 'USDT', 100000n * SCALE); // Buyer: 100,000 USDT
    wallet.credit(2, 'BTC', 10n * SCALE); // Seller: 10 BTC
  });

  it('should successfully cancel a resting limit buy order and unlock funds', () => {
    // 1. Place buy order (50,000 USDT for 1 BTC -> locks 50,000 USDT)
    placeUseCase.execute(100, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);
    expect(engine.activeOrders.has(100)).toBe(true);
    expect(wallet.getBalance(1, 'USDT').locked).toBe(50000n * SCALE);
    expect(wallet.getBalance(1, 'USDT').available).toBe(50000n * SCALE);

    // 2. Cancel order
    const code = cancelUseCase.execute(100);
    expect(code).toBe(ErrorCode.SUCCESS);

    // 3. Order should be removed from activeOrders and tree
    expect(engine.activeOrders.has(100)).toBe(false);
    expect(engine.bids.isEmpty()).toBe(true);

    // 4. Funds should be unlocked
    expect(wallet.getBalance(1, 'USDT').locked).toBe(0n);
    expect(wallet.getBalance(1, 'USDT').available).toBe(100000n * SCALE);

    // 5. Should write cancel entry to WAL
    expect(journalingPort.cancelEntries.length).toBe(1);
    expect(journalingPort.cancelEntries[0]).toBe(100);

    // 6. Should publish cancelled event
    expect(eventPublisherPort.cancellations.length).toBe(1);
    expect(eventPublisherPort.cancellations[0]).toEqual({
      orderId: 100,
      userId: 1,
      price: 50000n * SCALE,
      qty: 1n * SCALE,
      side: OrderSide.BUY,
    });
  });

  it('should successfully cancel a resting limit sell order and unlock base asset', () => {
    // 1. Place sell order (Locks 2 BTC)
    placeUseCase.execute(200, 2, OrderSide.SELL, OrderType.LIMIT, 55000n * SCALE, 2n * SCALE);
    expect(engine.activeOrders.has(200)).toBe(true);
    expect(wallet.getBalance(2, 'BTC').locked).toBe(2n * SCALE);
    expect(wallet.getBalance(2, 'BTC').available).toBe(8n * SCALE);

    // 2. Cancel order
    const code = cancelUseCase.execute(200);
    expect(code).toBe(ErrorCode.SUCCESS);

    // 3. Verifications
    expect(engine.activeOrders.has(200)).toBe(false);
    expect(wallet.getBalance(2, 'BTC').locked).toBe(0n);
    expect(wallet.getBalance(2, 'BTC').available).toBe(10n * SCALE);
  });

  it('should return ORDER_NOT_FOUND and do nothing when order does not exist', () => {
    const code = cancelUseCase.execute(999);
    expect(code).toBe(ErrorCode.ORDER_NOT_FOUND);

    expect(journalingPort.cancelEntries.length).toBe(0);
    expect(eventPublisherPort.cancellations.length).toBe(0);
  });

  it('should return ORDER_NOT_FOUND when engine cancelOrder returns false', () => {
    // Place order
    placeUseCase.execute(100, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);
    expect(engine.activeOrders.has(100)).toBe(true);

    // Mock engine.cancelOrder to return false
    const originalCancelOrder = engine.cancelOrder;
    engine.cancelOrder = jest.fn().mockReturnValue(false);

    const code = cancelUseCase.execute(100);
    expect(code).toBe(ErrorCode.ORDER_NOT_FOUND);

    // Restore
    engine.cancelOrder = originalCancelOrder;
  });
});
