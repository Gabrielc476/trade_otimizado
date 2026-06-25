import { OrderSide } from '../enums/OrderSide';
import { OrderType } from '../enums/OrderType';

export class Order {
  public id: number;
  public userId: number;
  public symbol: string;
  public side: OrderSide;
  public type: OrderType;
  public price: bigint;
  public qty: bigint;
  public filledQty: bigint;
  public next: Order | null;
  public prev: Order | null;

  constructor() {
    this.id = 0;
    this.userId = 0;
    this.symbol = '';
    this.side = OrderSide.BUY;
    this.type = OrderType.LIMIT;
    this.price = 0n;
    this.qty = 0n;
    this.filledQty = 0n;
    this.next = null;
    this.prev = null;
  }

  public reset(): void {
    this.id = 0;
    this.userId = 0;
    this.symbol = '';
    this.side = OrderSide.BUY;
    this.type = OrderType.LIMIT;
    this.price = 0n;
    this.qty = 0n;
    this.filledQty = 0n;
    this.next = null;
    this.prev = null;
  }
}
