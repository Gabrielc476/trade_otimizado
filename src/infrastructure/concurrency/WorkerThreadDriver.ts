import { Worker } from 'worker_threads';
import * as path from 'path';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';

export class WorkerThreadDriver {
  private worker: Worker;
  private sab: SharedArrayBuffer;
  private eventListeners: ((message: any) => void)[] = [];

  constructor(assets: string[], walPath?: string) {
    // 10,000 users * 2 assets * 2 balances (available, locked) * 8 bytes = 320,000 bytes
    this.sab = new SharedArrayBuffer(320000);
    
    // Resolve the worker file path
    const workerPath = path.resolve(__dirname, 'engine.worker.ts');
    
    // Check if running in ts-node or jest (which executes TS directly)
    const isTsNode = __filename.endsWith('.ts');
    
    this.worker = new Worker(workerPath, {
      workerData: {
        sab: this.sab,
        assets,
        walPath,
      },
      execArgv: isTsNode ? ['-r', 'ts-node/register'] : [],
    });

    this.worker.on('message', (msg) => {
      for (const listener of this.eventListeners) {
        listener(msg);
      }
    });

    this.worker.on('error', (err) => {
      console.error('Worker thread error:', err);
    });
  }

  public getSharedArrayBuffer(): SharedArrayBuffer {
    return this.sab;
  }

  public sendOrder(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): void {
    this.worker.postMessage({
      type: 'PLACE_ORDER',
      orderId,
      userId,
      side,
      orderType: type,
      price,
      qty,
    });
  }

  public cancelOrder(orderId: number): void {
    this.worker.postMessage({
      type: 'CANCEL_ORDER',
      orderId,
    });
  }

  public sendDeposit(userId: number, asset: string, amount: bigint): void {
    this.worker.postMessage({
      type: 'DEPOSIT',
      userId,
      asset,
      amount,
    });
  }

  public sendWithdraw(userId: number, asset: string, amount: bigint): void {
    this.worker.postMessage({
      type: 'WITHDRAW',
      userId,
      asset,
      amount,
    });
  }

  public onMessage(listener: (message: any) => void): void {
    this.eventListeners.push(listener);
  }

  public terminate(): Promise<number> {
    return this.worker.terminate();
  }
}
