import { JournalingPort } from '../../application/ports/JournalingPort';
import { EventPublisherPort } from '../../application/ports/EventPublisherPort';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';

export class SwitchableJournalingPort implements JournalingPort {
  private backingPort: JournalingPort;
  private enabled: boolean = true;

  constructor(backingPort: JournalingPort) {
    this.backingPort = backingPort;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public writeEntry(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): void {
    if (this.enabled) {
      this.backingPort.writeEntry(orderId, userId, side, type, price, qty);
    }
  }

  public writeCancelEntry(orderId: number): void {
    if (this.enabled) {
      this.backingPort.writeCancelEntry(orderId);
    }
  }

  public writeDepositEntry(userId: number, asset: string, amount: bigint): void {
    if (this.enabled) {
      this.backingPort.writeDepositEntry(userId, asset, amount);
    }
  }

  public writeWithdrawEntry(userId: number, asset: string, amount: bigint): void {
    if (this.enabled) {
      this.backingPort.writeWithdrawEntry(userId, asset, amount);
    }
  }
}

export class SwitchableEventPublisherPort implements EventPublisherPort {
  private backingPort: EventPublisherPort;
  private enabled: boolean = true;

  constructor(backingPort: EventPublisherPort) {
    this.backingPort = backingPort;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public publishTrade(buyerId: number, sellerId: number, price: bigint, qty: bigint): void {
    if (this.enabled) {
      this.backingPort.publishTrade(buyerId, sellerId, price, qty);
    }
  }

  public publishOrderPlaced(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): void {
    if (this.enabled) {
      this.backingPort.publishOrderPlaced(orderId, userId, side, type, price, qty);
    }
  }

  public publishOrderCancelled(
    orderId: number,
    userId: number,
    price: bigint,
    qty: bigint,
    side: OrderSide
  ): void {
    if (this.enabled) {
      this.backingPort.publishOrderCancelled(orderId, userId, price, qty, side);
    }
  }
}
