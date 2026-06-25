import { Balance } from '../../domain/entities/Wallet';

export class SharedMemoryWalletReader {
  private view: BigInt64Array;
  private assetIndices: Map<string, number>;

  constructor(sab: SharedArrayBuffer, assets: string[]) {
    this.view = new BigInt64Array(sab);
    this.assetIndices = new Map();
    for (let i = 0; i < assets.length; i++) {
      this.assetIndices.set(assets[i], i);
    }
  }

  private getBaseIndex(userId: number, asset: string): number {
    const assetIdx = this.assetIndices.get(asset);
    if (assetIdx === undefined) return -1;
    if (userId < 0 || userId >= 10000) return -1;
    return (userId * 4) + (assetIdx * 2);
  }

  public getBalance(userId: number, asset: string): Balance {
    const baseIdx = this.getBaseIndex(userId, asset);
    if (baseIdx === -1) {
      return { available: 0n, locked: 0n };
    }
    const available = Atomics.load(this.view, baseIdx);
    const locked = Atomics.load(this.view, baseIdx + 1);
    return { available, locked };
  }
}
