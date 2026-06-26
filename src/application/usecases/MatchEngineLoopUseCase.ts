import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';
import { PlaceOrderUseCase } from './PlaceOrderUseCase';
import { CancelOrderUseCase } from './CancelOrderUseCase';

import { DepositUseCase } from './DepositUseCase';
import { WithdrawUseCase } from './WithdrawUseCase';

export interface EngineEvent {
  type: 'PLACE_ORDER' | 'CANCEL_ORDER' | 'DEPOSIT' | 'WITHDRAW';
  orderId?: number;
  userId?: number;
  side?: OrderSide;
  orderType?: OrderType;
  price?: bigint;
  qty?: bigint;
  asset?: string;
  amount?: bigint;
}

export class MatchEngineLoopUseCase {
  public onEventProcessed?: (elapsedMs: number) => void;
  private queue: EngineEvent[];
  private placeOrderUseCase: PlaceOrderUseCase;
  private cancelOrderUseCase: CancelOrderUseCase;
  private depositUseCase: DepositUseCase;
  private withdrawUseCase: WithdrawUseCase;
  private isProcessing: boolean;

  constructor(
    placeOrderUseCase: PlaceOrderUseCase,
    cancelOrderUseCase: CancelOrderUseCase,
    depositUseCase: DepositUseCase,
    withdrawUseCase: WithdrawUseCase
  ) {
    this.queue = [];
    this.placeOrderUseCase = placeOrderUseCase;
    this.cancelOrderUseCase = cancelOrderUseCase;
    this.depositUseCase = depositUseCase;
    this.withdrawUseCase = withdrawUseCase;
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
    const start = process.hrtime.bigint();
    if (event.type === 'PLACE_ORDER') {
      this.placeOrderUseCase.execute(
        event.orderId!,
        event.userId!,
        event.side!,
        event.orderType!,
        event.price!,
        event.qty!
      );
    } else if (event.type === 'CANCEL_ORDER') {
      this.cancelOrderUseCase.execute(event.orderId!);
    } else if (event.type === 'DEPOSIT') {
      this.depositUseCase.execute(event.userId!, event.asset!, event.amount!);
    } else if (event.type === 'WITHDRAW') {
      this.withdrawUseCase.execute(event.userId!, event.asset!, event.amount!);
    }
    const end = process.hrtime.bigint();
    if (this.onEventProcessed) {
      const elapsedMs = Number(end - start) / 1_000_000;
      this.onEventProcessed(elapsedMs);
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}
