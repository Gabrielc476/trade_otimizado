import { DoublyLinkedList } from '../../domain/entities/DoublyLinkedList';
import { Order } from '../../domain/entities/Order';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';

describe('DoublyLinkedList', () => {
  let list: DoublyLinkedList;
  let o1: Order;
  let o2: Order;
  let o3: Order;

  beforeEach(() => {
    list = new DoublyLinkedList();
    o1 = new Order();
    o1.id = 1;
    o1.qty = 10n;

    o2 = new Order();
    o2.id = 2;
    o2.qty = 20n;

    o3 = new Order();
    o3.id = 3;
    o3.qty = 30n;
  });

  it('should be empty initially', () => {
    expect(list.isEmpty()).toBe(true);
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
  });

  it('should append elements correctly', () => {
    list.append(o1);
    expect(list.isEmpty()).toBe(false);
    expect(list.head).toBe(o1);
    expect(list.tail).toBe(o1);

    list.append(o2);
    expect(list.head).toBe(o1);
    expect(list.tail).toBe(o2);
    expect(o1.next).toBe(o2);
    expect(o2.prev).toBe(o1);

    list.append(o3);
    expect(list.head).toBe(o1);
    expect(list.tail).toBe(o3);
    expect(o2.next).toBe(o3);
    expect(o3.prev).toBe(o2);
  });

  it('should remove elements from different positions', () => {
    list.append(o1);
    list.append(o2);
    list.append(o3);

    // Remove middle
    list.remove(o2);
    expect(list.head).toBe(o1);
    expect(list.tail).toBe(o3);
    expect(o1.next).toBe(o3);
    expect(o3.prev).toBe(o1);
    expect(o2.next).toBeNull();
    expect(o2.prev).toBeNull();

    // Remove head
    list.remove(o1);
    expect(list.head).toBe(o3);
    expect(list.tail).toBe(o3);
    expect(o3.prev).toBeNull();
    expect(o3.next).toBeNull();

    // Remove tail (only element left)
    list.remove(o3);
    expect(list.isEmpty()).toBe(true);
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
  });

  it('should remove head correctly when multiple elements exist', () => {
    list.append(o1);
    list.append(o2);
    list.remove(o1);
    expect(list.head).toBe(o2);
    expect(list.tail).toBe(o2);
    expect(o2.prev).toBeNull();
  });

  it('should remove tail correctly when multiple elements exist', () => {
    list.append(o1);
    list.append(o2);
    list.remove(o2);
    expect(list.head).toBe(o1);
    expect(list.tail).toBe(o1);
    expect(o1.next).toBeNull();
  });
});
