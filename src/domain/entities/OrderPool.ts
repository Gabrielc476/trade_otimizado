import { Order } from './Order';
import { OrderSide } from '../enums/OrderSide';
import { OrderType } from '../enums/OrderType';

export class OrderPool {
  private pool: Order[];
  private head: number;

  constructor(initialSize: number) {
    this.pool = new Array(initialSize);
    for (let i = 0; i < initialSize; i++) {
      this.pool[i] = new Order();
    }
    this.head = initialSize - 1;
  }

  public acquire(
    id: number,
    userId: number,
    symbol: string,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): Order {
    let order: Order;
    if (this.head < 0) {
      // Crescimento dinâmico: se o pool esgotar, cria uma nova instância
      order = new Order();
    } else {
      order = this.pool[this.head--];
    }

    this.populate(order, id, userId, symbol, side, type, price, qty);
    return order;
  }

  public release(order: Order): void {
    order.reset();
    if (this.head < this.pool.length - 1) {
      this.pool[++this.head] = order;
    }
  }

  public getAvailableCount(): number {
    return this.head + 1;
  }

  private populate(
    order: Order,
    id: number,
    userId: number,
    symbol: string,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): void {
    order.id = id;
    order.userId = userId;
    order.symbol = symbol;
    order.side = side;
    order.type = type;
    order.price = price;
    order.qty = qty;
    order.filledQty = 0n;
  }
}
