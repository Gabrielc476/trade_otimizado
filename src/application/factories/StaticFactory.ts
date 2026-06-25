import { MatchingEngine } from '../../domain/entities/MatchingEngine';
import { Wallet } from '../../domain/entities/Wallet';
import { OrderPool } from '../../domain/entities/OrderPool';
import { JournalingPort } from '../ports/JournalingPort';
import { EventPublisherPort } from '../ports/EventPublisherPort';
import { PlaceOrderUseCase } from '../usecases/PlaceOrderUseCase';
import { CancelOrderUseCase } from '../usecases/CancelOrderUseCase';
import { MatchEngineLoopUseCase } from '../usecases/MatchEngineLoopUseCase';

export class StaticFactory {
  public static createEngine(
    symbol: string,
    baseAsset: string,
    quoteAsset: string,
    wallet: Wallet,
    pool: OrderPool,
    journalingPort: JournalingPort,
    eventPublisherPort: EventPublisherPort
  ) {
    const engine = new MatchingEngine(symbol, baseAsset, quoteAsset, wallet, pool);
    const placeOrderUseCase = new PlaceOrderUseCase(engine, journalingPort, eventPublisherPort);
    const cancelOrderUseCase = new CancelOrderUseCase(engine, journalingPort, eventPublisherPort);
    const loopUseCase = new MatchEngineLoopUseCase(placeOrderUseCase, cancelOrderUseCase);

    return {
      engine,
      placeOrderUseCase,
      cancelOrderUseCase,
      loopUseCase,
    };
  }
}
