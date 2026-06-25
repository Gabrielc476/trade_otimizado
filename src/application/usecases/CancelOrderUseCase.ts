import { MatchingEngine } from '../../domain/entities/MatchingEngine';
import { ErrorCode } from '../../domain/enums/ErrorCode';
import { JournalingPort } from '../ports/JournalingPort';
import { EventPublisherPort } from '../ports/EventPublisherPort';

export class CancelOrderUseCase {
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

  public execute(orderId: number): ErrorCode {
    // 1. Check activeOrders to get metadata before deleting from engine
    const order = this.engine.activeOrders.get(orderId);
    if (!order) {
      return ErrorCode.ORDER_NOT_FOUND;
    }

    const userId = order.userId;
    const price = order.price;
    const qty = order.qty;
    const side = order.side;

    // 2. Perform cancellation in Matching Engine
    const success = this.engine.cancelOrder(orderId);
    if (!success) {
      return ErrorCode.ORDER_NOT_FOUND;
    }

    // 3. Journal the cancel entry
    this.journalingPort.writeCancelEntry(orderId);

    // 4. Publish cancelled event
    this.eventPublisherPort.publishOrderCancelled(orderId, userId, price, qty, side);

    return ErrorCode.SUCCESS;
  }
}
