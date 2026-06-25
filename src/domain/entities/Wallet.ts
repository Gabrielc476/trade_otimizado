export interface Balance {
  available: bigint;
  locked: bigint;
}

export class Wallet {
  private balances: Map<number, Map<string, Balance>>;
  private view?: BigInt64Array;
  private assetIndices: Map<string, number>;

  constructor(sab?: SharedArrayBuffer, assets?: string[]) {
    this.balances = new Map();
    this.assetIndices = new Map();
    if (sab && assets) {
      this.view = new BigInt64Array(sab);
      for (let i = 0; i < assets.length; i++) {
        this.assetIndices.set(assets[i], i);
      }
    }
  }

  private getBaseIndex(userId: number, asset: string): number {
    if (!this.view) return -1;
    const assetIdx = this.assetIndices.get(asset);
    if (assetIdx === undefined) return -1;
    if (userId < 0 || userId >= 10000) return -1;
    return (userId * 4) + (assetIdx * 2);
  }

  public getBalance(userId: number, asset: string): Balance {
    const baseIdx = this.getBaseIndex(userId, asset);
    if (baseIdx !== -1 && this.view) {
      const available = Atomics.load(this.view, baseIdx);
      const locked = Atomics.load(this.view, baseIdx + 1);
      return { available, locked };
    }

    let userMap = this.balances.get(userId);
    if (!userMap) {
      userMap = new Map();
      this.balances.set(userId, userMap);
    }

    let balance = userMap.get(asset);
    if (!balance) {
      balance = { available: 0n, locked: 0n };
      userMap.set(asset, balance);
    }

    return balance;
  }

  public credit(userId: number, asset: string, amount: bigint): void {
    if (amount <= 0n) return;
    const baseIdx = this.getBaseIndex(userId, asset);
    if (baseIdx !== -1 && this.view) {
      Atomics.add(this.view, baseIdx, amount);
      return;
    }

    const balance = this.getBalance(userId, asset);
    balance.available += amount;
  }

  public debit(userId: number, asset: string, amount: bigint): boolean {
    if (amount <= 0n) return true;
    const baseIdx = this.getBaseIndex(userId, asset);
    if (baseIdx !== -1 && this.view) {
      const available = Atomics.load(this.view, baseIdx);
      if (available < amount) {
        return false;
      }
      Atomics.sub(this.view, baseIdx, amount);
      return true;
    }

    const balance = this.getBalance(userId, asset);
    if (balance.available < amount) {
      return false;
    }
    balance.available -= amount;
    return true;
  }

  public lock(userId: number, asset: string, amount: bigint): boolean {
    if (amount <= 0n) return true;
    const baseIdx = this.getBaseIndex(userId, asset);
    if (baseIdx !== -1 && this.view) {
      const available = Atomics.load(this.view, baseIdx);
      if (available < amount) {
        return false;
      }
      Atomics.sub(this.view, baseIdx, amount);
      Atomics.add(this.view, baseIdx + 1, amount);
      return true;
    }

    const balance = this.getBalance(userId, asset);
    if (balance.available < amount) {
      return false;
    }
    balance.available -= amount;
    balance.locked += amount;
    return true;
  }

  public unlock(userId: number, asset: string, amount: bigint): void {
    if (amount <= 0n) return;
    const baseIdx = this.getBaseIndex(userId, asset);
    if (baseIdx !== -1 && this.view) {
      const locked = Atomics.load(this.view, baseIdx + 1);
      if (locked < amount) {
        Atomics.add(this.view, baseIdx, locked);
        Atomics.store(this.view, baseIdx + 1, 0n);
      } else {
        Atomics.sub(this.view, baseIdx + 1, amount);
        Atomics.add(this.view, baseIdx, amount);
      }
      return;
    }

    const balance = this.getBalance(userId, asset);
    if (balance.locked < amount) {
      balance.available += balance.locked;
      balance.locked = 0n;
    } else {
      balance.locked -= amount;
      balance.available += amount;
    }
  }

  public debitLocked(userId: number, asset: string, amount: bigint): boolean {
    if (amount <= 0n) return true;
    const baseIdx = this.getBaseIndex(userId, asset);
    if (baseIdx !== -1 && this.view) {
      const locked = Atomics.load(this.view, baseIdx + 1);
      if (locked < amount) {
        return false;
      }
      Atomics.sub(this.view, baseIdx + 1, amount);
      return true;
    }

    const balance = this.getBalance(userId, asset);
    if (balance.locked < amount) {
      return false;
    }
    balance.locked -= amount;
    return true;
  }

  public clear(): void {
    if (this.view) {
      this.view.fill(0n);
    }
    this.balances.clear();
  }
}

