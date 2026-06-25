import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';

export interface JournalingPort {
  writeEntry(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): void;
  writeCancelEntry(orderId: number): void;
  writeDepositEntry(userId: number, asset: string, amount: bigint): void;
  writeWithdrawEntry(userId: number, asset: string, amount: bigint): void;
}
