import { MatchingEngine, SCALE, Trade } from '../../domain/entities/MatchingEngine';
import { ErrorCode } from '../../domain/enums/ErrorCode';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';
import { JournalingPort } from '../ports/JournalingPort';
import { EventPublisherPort } from '../ports/EventPublisherPort';

export class PlaceOrderUseCase {
  private engine: MatchingEngine;
  private journalingPort: JournalingPort;
  private eventPublisherPort: EventPublisherPort;

  constructor(
    engine: MatchingEngine,
    journalingPort: JournalingPort,
    eventPublisherPort: EventPublisherPort
  ) {
    this.engine = engine;
    this.journalingPort = journalingPort;
    this.eventPublisherPort = eventPublisherPort;
  }

  public execute(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): [ErrorCode, Trade[]] {
    // 1. Perform balance validation before journaling
    if (side === OrderSide.BUY) {
      const cost = (price * qty) / SCALE;
      const balance = this.engine.wallet.getBalance(userId, this.engine.quoteAsset);
      if (balance.available < cost) {
        return [ErrorCode.INSUFFICIENT_BALANCE, []];
      }
    } else {
      const balance = this.engine.wallet.getBalance(userId, this.engine.baseAsset);
      if (balance.available < qty) {
        return [ErrorCode.INSUFFICIENT_BALANCE, []];
      }
    }

    // 2. Journal the order entry
    this.journalingPort.writeEntry(orderId, userId, side, type, price, qty);

    // 3. Process order in Matching Engine
    const [code, trades] = this.engine.processOrder(orderId, userId, side, type, price, qty);

    if (code === ErrorCode.SUCCESS) {
      // 4. Publish order placed event
      this.eventPublisherPort.publishOrderPlaced(orderId, userId, side, type, price, qty);

      // 5. Publish trades
      for (let i = 0; i < trades.length; i++) {
        const trade = trades[i];
        this.eventPublisherPort.publishTrade(trade.buyerId, trade.sellerId, trade.price, trade.qty, side);
      }
    }

    return [code, trades];
  }
}
