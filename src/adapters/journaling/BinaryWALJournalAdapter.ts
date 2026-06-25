import * as fs from 'fs';
import { JournalingPort } from '../../application/ports/JournalingPort';
import { OrderSide } from '../../domain/enums/OrderSide';
import { OrderType } from '../../domain/enums/OrderType';

export class BinaryWALJournalAdapter implements JournalingPort {
  private fd: number;

  constructor(walPath: string) {
    // Open the WAL file for appending. Create it if it doesn't exist.
    this.fd = fs.openSync(walPath, 'a+');
  }

  public writeEntry(
    orderId: number,
    userId: number,
    side: OrderSide,
    type: OrderType,
    price: bigint,
    qty: bigint
  ): void {
    const buf = Buffer.alloc(33);
    buf.writeUInt8(1, 0); // recordType: 1 = PLACE_ORDER
    buf.writeDoubleLE(orderId, 1); // orderId as 64-bit float (8 bytes)
    buf.writeInt32LE(userId, 9); // userId as 32-bit int (4 bytes)
    buf.writeUInt8(side === OrderSide.BUY ? 0 : 1, 13); // side: 0 = BUY, 1 = SELL (1 byte)
    buf.writeUInt8(type === OrderType.LIMIT ? 0 : 1, 14); // type: 0 = LIMIT, 1 = MARKET (1 byte)
    buf.writeBigInt64LE(price, 15); // price as 64-bit int (8 bytes)
    buf.writeBigInt64LE(qty, 23); // qty as 64-bit int (8 bytes)
    buf.writeUInt16LE(0, 31); // padding (2 bytes)

    fs.writeSync(this.fd, buf, 0, 33);
  }

  public writeCancelEntry(orderId: number): void {
    const buf = Buffer.alloc(33);
    buf.writeUInt8(2, 0); // recordType: 2 = CANCEL_ORDER
    buf.writeDoubleLE(orderId, 1); // orderId as 64-bit float (8 bytes)
    // rest is padding/unused (24 bytes)

    fs.writeSync(this.fd, buf, 0, 33);
  }

  public writeDepositEntry(userId: number, asset: string, amount: bigint): void {
    const buf = Buffer.alloc(33);
    buf.writeUInt8(3, 0); // recordType: 3 = DEPOSIT
    buf.writeInt32LE(userId, 1); // userId (4 bytes)
    
    // Write asset (at most 8 bytes)
    const assetBuf = Buffer.alloc(8);
    assetBuf.write(asset, 'ascii');
    assetBuf.copy(buf, 5, 0, 8); // asset (8 bytes)

    buf.writeBigInt64LE(amount, 13); // amount (8 bytes)
    // rest is padding/unused (12 bytes)

    fs.writeSync(this.fd, buf, 0, 33);
  }

  public writeWithdrawEntry(userId: number, asset: string, amount: bigint): void {
    const buf = Buffer.alloc(33);
    buf.writeUInt8(4, 0); // recordType: 4 = WITHDRAW
    buf.writeInt32LE(userId, 1); // userId (4 bytes)

    // Write asset (at most 8 bytes)
    const assetBuf = Buffer.alloc(8);
    assetBuf.write(asset, 'ascii');
    assetBuf.copy(buf, 5, 0, 8); // asset (8 bytes)

    buf.writeBigInt64LE(amount, 13); // amount (8 bytes)
    // rest is padding/unused (12 bytes)

    fs.writeSync(this.fd, buf, 0, 33);
  }

  public close(): void {
    fs.closeSync(this.fd);
  }

  /**
   * Reads a binary WAL file from start to finish and decodes all 33-byte records.
   */
  public static readWAL(walPath: string): any[] {
    if (!fs.existsSync(walPath)) {
      return [];
    }

    const fd = fs.openSync(walPath, 'r');
    const stats = fs.fstatSync(fd);
    const fileSize = stats.size;

    const events: any[] = [];
    const recordBuffer = Buffer.alloc(33);
    let bytesRead = 0;

    while (bytesRead + 33 <= fileSize) {
      fs.readSync(fd, recordBuffer, 0, 33, bytesRead);
      bytesRead += 33;

      const recordType = recordBuffer.readUInt8(0);

      if (recordType === 1) {
        // PLACE_ORDER
        const orderId = recordBuffer.readDoubleLE(1);
        const userId = recordBuffer.readInt32LE(9);
        const side = recordBuffer.readUInt8(13) === 0 ? OrderSide.BUY : OrderSide.SELL;
        const type = recordBuffer.readUInt8(14) === 0 ? OrderType.LIMIT : OrderType.MARKET;
        const price = recordBuffer.readBigInt64LE(15);
        const qty = recordBuffer.readBigInt64LE(23);

        events.push({
          type: 'PLACE_ORDER',
          orderId,
          userId,
          side,
          orderType: type,
          price,
          qty,
        });
      } else if (recordType === 2) {
        // CANCEL_ORDER
        const orderId = recordBuffer.readDoubleLE(1);
        events.push({
          type: 'CANCEL_ORDER',
          orderId,
        });
      } else if (recordType === 3) {
        // DEPOSIT
        const userId = recordBuffer.readInt32LE(1);
        const asset = recordBuffer.toString('ascii', 5, 13).replace(/\0/g, '');
        const amount = recordBuffer.readBigInt64LE(13);

        events.push({
          type: 'DEPOSIT',
          userId,
          asset,
          amount,
        });
      } else if (recordType === 4) {
        // WITHDRAW
        const userId = recordBuffer.readInt32LE(1);
        const asset = recordBuffer.toString('ascii', 5, 13).replace(/\0/g, '');
        const amount = recordBuffer.readBigInt64LE(13);

        events.push({
          type: 'WITHDRAW',
          userId,
          asset,
          amount,
        });
      }
    }

    fs.closeSync(fd);
    return events;
  }
}
