import { Wallet } from '../../domain/entities/Wallet';
import { OrderPool } from '../../domain/entities/OrderPool';
import { MatchingEngine, SCALE } from '../../domain/entities/MatchingEngine';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';
import { ErrorCode } from '../../domain/enums/ErrorCode';
import { JournalingPort } from '../../application/ports/JournalingPort';
import { EventPublisherPort } from '../../application/ports/EventPublisherPort';
import { PlaceOrderUseCase } from '../../application/usecases/PlaceOrderUseCase';

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

  writeDepositEntry(userId: number, asset: string, amount: bigint): void {}
  writeWithdrawEntry(userId: number, asset: string, amount: bigint): void {}
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

describe('PlaceOrderUseCase', () => {
  let wallet: Wallet;
  let pool: OrderPool;
  let engine: MatchingEngine;
  let journalingPort: MockJournalingPort;
  let eventPublisherPort: MockEventPublisherPort;
  let useCase: PlaceOrderUseCase;

  beforeEach(() => {
    wallet = new Wallet();
    pool = new OrderPool(100);
    engine = new MatchingEngine('BTC/USDT', 'BTC', 'USDT', wallet, pool);
    journalingPort = new MockJournalingPort();
    eventPublisherPort = new MockEventPublisherPort();
    useCase = new PlaceOrderUseCase(engine, journalingPort, eventPublisherPort);

    // Provide initial funds
    wallet.credit(1, 'USDT', 100000n * SCALE); // Buyer: 100,000 USDT
    wallet.credit(2, 'BTC', 10n * SCALE); // Seller: 10 BTC
  });

  it('should successfully place and book a limit order when balance is sufficient', () => {
    const [code, trades] = useCase.execute(
      100,
      1,
      OrderSide.BUY,
      OrderType.LIMIT,
      50000n * SCALE,
      1n * SCALE
    );

    expect(code).toBe(ErrorCode.SUCCESS);
    expect(trades.length).toBe(0);

    // 1. Should journal to WAL
    expect(journalingPort.entries.length).toBe(1);
    expect(journalingPort.entries[0]).toEqual({
      orderId: 100,
      userId: 1,
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      price: 50000n * SCALE,
      qty: 1n * SCALE,
    });

    // 2. Should publish placed event
    expect(eventPublisherPort.placements.length).toBe(1);
    expect(eventPublisherPort.placements[0]).toEqual({
      orderId: 100,
      userId: 1,
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      price: 50000n * SCALE,
      qty: 1n * SCALE,
    });

    // 3. Should lock balance
    expect(wallet.getBalance(1, 'USDT').locked).toBe(50000n * SCALE);
  });

  it('should reject order and not write to WAL/Publisher when balance is insufficient', () => {
    const [code, trades] = useCase.execute(
      100,
      1,
      OrderSide.BUY,
      OrderType.LIMIT,
      200000n * SCALE, // Exceeds 100,000 USDT
      1n * SCALE
    );

    expect(code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
    expect(trades.length).toBe(0);

    // Should NOT write to WAL or publish anything
    expect(journalingPort.entries.length).toBe(0);
    expect(eventPublisherPort.placements.length).toBe(0);
    expect(wallet.getBalance(1, 'USDT').locked).toBe(0n);
  });

  it('should reject sell order and not write to WAL/Publisher when base balance is insufficient', () => {
    const [code, trades] = useCase.execute(
      102,
      2,
      OrderSide.SELL,
      OrderType.LIMIT,
      50000n * SCALE,
      20n * SCALE // Exceeds seller's 10 BTC
    );

    expect(code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
    expect(trades.length).toBe(0);
    expect(journalingPort.entries.length).toBe(0);
    expect(eventPublisherPort.placements.length).toBe(0);
  });

  it('should match orders, publish trade events, and release fully filled orders', () => {
    // Place sell order first
    useCase.execute(100, 2, OrderSide.SELL, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);
    expect(engine.activeOrders.has(100)).toBe(true);

    // Place matching buy order
    const [code, trades] = useCase.execute(101, 1, OrderSide.BUY, OrderType.LIMIT, 50000n * SCALE, 1n * SCALE);

    expect(code).toBe(ErrorCode.SUCCESS);
    expect(trades.length).toBe(1);
    expect(trades[0].price).toBe(50000n * SCALE);
    expect(trades[0].qty).toBe(1n * SCALE);

    // Should publish trade event
    expect(eventPublisherPort.trades.length).toBe(1);
    expect(eventPublisherPort.trades[0]).toEqual({
      buyerId: 1,
      sellerId: 2,
      price: 50000n * SCALE,
      qty: 1n * SCALE,
    });

    // Both orders should be fully filled and removed from activeOrders
    expect(engine.activeOrders.has(100)).toBe(false);
    expect(engine.activeOrders.has(101)).toBe(false);
  });
});
