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
import { MatchEngineLoopUseCase, EngineEvent } from '../../application/usecases/MatchEngineLoopUseCase';

class MockJournalingPort implements JournalingPort {
  writeEntry(): void {}
  writeCancelEntry(): void {}
}

class MockEventPublisherPort implements EventPublisherPort {
  publishTrade(): void {}
  publishOrderPlaced(): void {}
  publishOrderCancelled(): void {}
}

describe('MatchEngineLoopUseCase', () => {
  let wallet: Wallet;
  let pool: OrderPool;
  let engine: MatchingEngine;
  let placeUseCase: PlaceOrderUseCase;
  let cancelUseCase: CancelOrderUseCase;
  let loopUseCase: MatchEngineLoopUseCase;

  beforeEach(() => {
    wallet = new Wallet();
    pool = new OrderPool(100);
    engine = new MatchingEngine('BTC/USDT', 'BTC', 'USDT', wallet, pool);
    const journalingPort = new MockJournalingPort();
    const eventPublisherPort = new MockEventPublisherPort();
    placeUseCase = new PlaceOrderUseCase(engine, journalingPort, eventPublisherPort);
    cancelUseCase = new CancelOrderUseCase(engine, journalingPort, eventPublisherPort);
    loopUseCase = new MatchEngineLoopUseCase(placeUseCase, cancelUseCase);

    // Provide initial funds
    wallet.credit(1, 'USDT', 100000n * SCALE); // Buyer: 100,000 USDT
    wallet.credit(2, 'BTC', 10n * SCALE); // Seller: 10 BTC
  });

  it('should process events sequentially in FIFO order', () => {
    // 1. Enqueue a Sell limit order at 50,000 USDT for 1 BTC
    const sellEvent: EngineEvent = {
      type: 'PLACE_ORDER',
      orderId: 100,
      userId: 2,
      side: OrderSide.SELL,
      orderType: OrderType.LIMIT,
      price: 50000n * SCALE,
      qty: 1n * SCALE,
    };

    // 2. Enqueue a Buy limit order at 50,000 USDT for 1 BTC
    const buyEvent: EngineEvent = {
      type: 'PLACE_ORDER',
      orderId: 101,
      userId: 1,
      side: OrderSide.BUY,
      orderType: OrderType.LIMIT,
      price: 50000n * SCALE,
      qty: 1n * SCALE,
    };

    // Enqueue both
    loopUseCase.enqueue(sellEvent);
    loopUseCase.enqueue(buyEvent);

    // Both should have been processed immediately, executing the match!
    expect(engine.activeOrders.has(100)).toBe(false);
    expect(engine.activeOrders.has(101)).toBe(false);

    // Wallet balances should be updated reflecting the execution
    expect(wallet.getBalance(1, 'BTC').available).toBe(1n * SCALE); // Buyer got 1 BTC
    expect(wallet.getBalance(2, 'USDT').available).toBe(50000n * SCALE); // Seller got 50,000 USDT
  });

  it('should process cancel events correctly through the loop', () => {
    // 1. Place resting buy order
    const buyEvent: EngineEvent = {
      type: 'PLACE_ORDER',
      orderId: 200,
      userId: 1,
      side: OrderSide.BUY,
      orderType: OrderType.LIMIT,
      price: 49000n * SCALE,
      qty: 1n * SCALE,
    };
    loopUseCase.enqueue(buyEvent);
    expect(engine.activeOrders.has(200)).toBe(true);

    // 2. Enqueue cancellation
    const cancelEvent: EngineEvent = {
      type: 'CANCEL_ORDER',
      orderId: 200,
    };
    loopUseCase.enqueue(cancelEvent);

    // Order should be cancelled
    expect(engine.activeOrders.has(200)).toBe(false);
    expect(wallet.getBalance(1, 'USDT').locked).toBe(0n);
  });

  it('should handle re-entrancy and return correct queue length', () => {
    const originalExecute = placeUseCase.execute;
    
    placeUseCase.execute = jest.fn().mockImplementation((
      orderId: number,
      userId: number,
      side: OrderSide,
      type: OrderType,
      price: bigint,
      qty: bigint
    ) => {
      expect(loopUseCase.getQueueLength()).toBe(0);
      
      const cancelEvent: EngineEvent = {
        type: 'CANCEL_ORDER',
        orderId: 200,
      };
      loopUseCase.enqueue(cancelEvent);
      
      expect(loopUseCase.getQueueLength()).toBe(1);
      
      return originalExecute.call(placeUseCase, orderId, userId, side, type, price, qty);
    });

    const buyEvent: EngineEvent = {
      type: 'PLACE_ORDER',
      orderId: 200,
      userId: 1,
      side: OrderSide.BUY,
      orderType: OrderType.LIMIT,
      price: 49000n * SCALE,
      qty: 1n * SCALE,
    };

    loopUseCase.enqueue(buyEvent);

    expect(engine.activeOrders.has(200)).toBe(false);
    expect(loopUseCase.getQueueLength()).toBe(0);

    placeUseCase.execute = originalExecute;
  });
});
