import { parentPort } from 'worker_threads';
import { MatchEngineLoopUseCase, EngineEvent } from '../../application/usecases/MatchEngineLoopUseCase';

export class WorkerThreadMessageAdapter {
  private loopUseCase: MatchEngineLoopUseCase;

  constructor(loopUseCase: MatchEngineLoopUseCase) {
    this.loopUseCase = loopUseCase;
  }

  public start(): void {
    if (!parentPort) {
      throw new Error('WorkerThreadMessageAdapter must be executed within a Worker Thread');
    }

    parentPort.on('message', (msg: any) => {
      if (msg.type === 'PLACE_ORDER') {
        const event: EngineEvent = {
          type: 'PLACE_ORDER',
          orderId: msg.orderId,
          userId: msg.userId,
          side: msg.side,
          orderType: msg.orderType,
          price: msg.price,
          qty: msg.qty,
        };
        this.loopUseCase.enqueue(event);
      } else if (msg.type === 'CANCEL_ORDER') {
        const event: EngineEvent = {
          type: 'CANCEL_ORDER',
          orderId: msg.orderId,
        };
        this.loopUseCase.enqueue(event);
      } else if (msg.type === 'DEPOSIT') {
        const event: EngineEvent = {
          type: 'DEPOSIT',
          userId: msg.userId,
          asset: msg.asset,
          amount: msg.amount,
        };
        this.loopUseCase.enqueue(event);
      } else if (msg.type === 'WITHDRAW') {
        const event: EngineEvent = {
          type: 'WITHDRAW',
          userId: msg.userId,
          asset: msg.asset,
          amount: msg.amount,
        };
        this.loopUseCase.enqueue(event);
      }
    });
  }
}
