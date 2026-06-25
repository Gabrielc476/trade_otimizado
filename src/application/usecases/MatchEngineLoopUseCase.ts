import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';
import { PlaceOrderUseCase } from './PlaceOrderUseCase';
import { CancelOrderUseCase } from './CancelOrderUseCase';

export interface EngineEvent {
  type: 'PLACE_ORDER' | 'CANCEL_ORDER';
  orderId: number;
  userId?: number;
  side?: OrderSide;
  orderType?: OrderType;
  price?: bigint;
  qty?: bigint;
}

export class MatchEngineLoopUseCase {
  private queue: EngineEvent[];
  private placeOrderUseCase: PlaceOrderUseCase;
  private cancelOrderUseCase: CancelOrderUseCase;
  private isProcessing: boolean;

  constructor(
    placeOrderUseCase: PlaceOrderUseCase,
    cancelOrderUseCase: CancelOrderUseCase
  ) {
    this.queue = [];
    this.placeOrderUseCase = placeOrderUseCase;
    this.cancelOrderUseCase = cancelOrderUseCase;
    this.isProcessing = false;
  }

  public enqueue(event: EngineEvent): void {
    this.queue.push(event);
    this.runLoop();
  }

  private runLoop(): void {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;

    // Process all events sequentially to preserve FIFO order in the engine thread
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      this.processEvent(event);
    }

    this.isProcessing = false;
  }

  private processEvent(event: EngineEvent): void {
    if (event.type === 'PLACE_ORDER') {
      this.placeOrderUseCase.execute(
        event.orderId,
        event.userId!,
        event.side!,
        event.orderType!,
        event.price!,
        event.qty!
      );
    } else if (event.type === 'CANCEL_ORDER') {
      this.cancelOrderUseCase.execute(event.orderId);
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}
