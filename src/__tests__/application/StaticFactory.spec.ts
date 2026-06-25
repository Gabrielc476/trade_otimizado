import { Wallet } from '../../domain/entities/Wallet';
import { OrderPool } from '../../domain/entities/OrderPool';
import { StaticFactory } from '../../application/factories/StaticFactory';
import { JournalingPort } from '../../application/ports/JournalingPort';
import { EventPublisherPort } from '../../application/ports/EventPublisherPort';

class MockJournalingPort implements JournalingPort {
  writeEntry(): void {}
  writeCancelEntry(): void {}
}

class MockEventPublisherPort implements EventPublisherPort {
  publishTrade(): void {}
  publishOrderPlaced(): void {}
  publishOrderCancelled(): void {}
}

describe('StaticFactory', () => {
  it('should correctly construct and wire up all application components', () => {
    const wallet = new Wallet();
    const pool = new OrderPool(10);
    const journalingPort = new MockJournalingPort();
    const eventPublisherPort = new MockEventPublisherPort();

    const result = StaticFactory.createEngine(
      'BTC/USDT',
      'BTC',
      'USDT',
      wallet,
      pool,
      journalingPort,
      eventPublisherPort
    );

    expect(result.engine).toBeDefined();
    expect(result.placeOrderUseCase).toBeDefined();
    expect(result.cancelOrderUseCase).toBeDefined();
    expect(result.loopUseCase).toBeDefined();

    // Verify properties are injected and matching the types
    expect(result.engine.symbol).toBe('BTC/USDT');
    expect(result.engine.baseAsset).toBe('BTC');
    expect(result.engine.quoteAsset).toBe('USDT');
  });
});
