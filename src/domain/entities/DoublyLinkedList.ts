import { Order } from './Order';

export class DoublyLinkedList {
  public head: Order | null;
  public tail: Order | null;

  constructor() {
    this.head = null;
    this.tail = null;
  }

  public append(order: Order): void {
    if (this.tail === null) {
      this.head = order;
      this.tail = order;
      order.prev = null;
      order.next = null;
    } else {
      this.tail.next = order;
      order.prev = this.tail;
      order.next = null;
      this.tail = order;
    }
  }

  public remove(order: Order): void {
    if (order.prev !== null) {
      order.prev.next = order.next;
    } else {
      this.head = order.next;
    }

    if (order.next !== null) {
      order.next.prev = order.prev;
    } else {
      this.tail = order.prev;
    }

    order.prev = null;
    order.next = null;
  }

  public isEmpty(): boolean {
    return this.head === null;
  }
}
