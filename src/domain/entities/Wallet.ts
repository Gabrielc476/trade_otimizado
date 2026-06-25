export interface Balance {
  available: bigint;
  locked: bigint;
}

export class Wallet {
  private balances: Map<number, Map<string, Balance>>;

  constructor() {
    this.balances = new Map();
  }

  public getBalance(userId: number, asset: string): Balance {
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
    const balance = this.getBalance(userId, asset);
    balance.available += amount;
  }

  public debit(userId: number, asset: string, amount: bigint): boolean {
    if (amount <= 0n) return true;
    const balance = this.getBalance(userId, asset);
    if (balance.available < amount) {
      return false;
    }
    balance.available -= amount;
    return true;
  }

  public lock(userId: number, asset: string, amount: bigint): boolean {
    if (amount <= 0n) return true;
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
    const balance = this.getBalance(userId, asset);
    if (balance.locked < amount) {
      return false;
    }
    balance.locked -= amount;
    return true;
  }

  public clear(): void {
    this.balances.clear();
  }
}
