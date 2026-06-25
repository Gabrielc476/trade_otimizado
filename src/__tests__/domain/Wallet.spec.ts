import { Wallet } from '../../domain/entities/Wallet';

describe('Wallet', () => {
  let wallet: Wallet;

  beforeEach(() => {
    wallet = new Wallet();
  });

  it('should initialize empty balances', () => {
    const balance = wallet.getBalance(1, 'BTC');
    expect(balance.available).toBe(0n);
    expect(balance.locked).toBe(0n);
  });

  it('should credit funds correctly', () => {
    wallet.credit(1, 'BTC', 1000n);
    const balance = wallet.getBalance(1, 'BTC');
    expect(balance.available).toBe(1000n);
    expect(balance.locked).toBe(0n);

    // Negative or zero credit should have no effect
    wallet.credit(1, 'BTC', -500n);
    wallet.credit(1, 'BTC', 0n);
    expect(balance.available).toBe(1000n);
  });

  it('should debit available funds correctly', () => {
    wallet.credit(1, 'BTC', 1000n);

    // Debit within limits
    const success1 = wallet.debit(1, 'BTC', 300n);
    expect(success1).toBe(true);
    expect(wallet.getBalance(1, 'BTC').available).toBe(700n);

    // Debit exceeding available balance should fail
    const success2 = wallet.debit(1, 'BTC', 800n);
    expect(success2).toBe(false);
    expect(wallet.getBalance(1, 'BTC').available).toBe(700n); // Unchanged

    // Zero or negative debit
    expect(wallet.debit(1, 'BTC', 0n)).toBe(true);
    expect(wallet.debit(1, 'BTC', -10n)).toBe(true);
  });

  it('should lock and unlock funds correctly', () => {
    wallet.credit(1, 'USDT', 1000n);

    // Lock within limits
    const lockSuccess1 = wallet.lock(1, 'USDT', 400n);
    expect(lockSuccess1).toBe(true);
    let balance = wallet.getBalance(1, 'USDT');
    expect(balance.available).toBe(600n);
    expect(balance.locked).toBe(400n);

    // Lock exceeding available should fail
    const lockSuccess2 = wallet.lock(1, 'USDT', 700n);
    expect(lockSuccess2).toBe(false);
    balance = wallet.getBalance(1, 'USDT');
    expect(balance.available).toBe(600n);
    expect(balance.locked).toBe(400n);

    // Unlock within locked limits
    wallet.unlock(1, 'USDT', 150n);
    balance = wallet.getBalance(1, 'USDT');
    expect(balance.available).toBe(750n);
    expect(balance.locked).toBe(250n);

    // Unlock exceeding locked balance should release all locked and prevent negative
    wallet.unlock(1, 'USDT', 500n);
    balance = wallet.getBalance(1, 'USDT');
    expect(balance.available).toBe(1000n);
    expect(balance.locked).toBe(0n);
  });

  it('should debit locked funds correctly', () => {
    wallet.credit(1, 'BTC', 5n);
    wallet.lock(1, 'BTC', 3n);

    // Debit locked within limits
    const success1 = wallet.debitLocked(1, 'BTC', 2n);
    expect(success1).toBe(true);
    let balance = wallet.getBalance(1, 'BTC');
    expect(balance.available).toBe(2n);
    expect(balance.locked).toBe(1n);

    // Debit locked exceeding locked should fail
    const success2 = wallet.debitLocked(1, 'BTC', 2n);
    expect(success2).toBe(false);
    balance = wallet.getBalance(1, 'BTC');
    expect(balance.available).toBe(2n);
    expect(balance.locked).toBe(1n);
  });

  it('should clear all balances', () => {
    wallet.credit(1, 'BTC', 10n);
    wallet.clear();
    expect(wallet.getBalance(1, 'BTC').available).toBe(0n);
  });

  it('should handle zero or negative amounts in lock, unlock, and debitLocked', () => {
    wallet.credit(1, 'BTC', 10n);
    expect(wallet.lock(1, 'BTC', 0n)).toBe(true);
    expect(wallet.lock(1, 'BTC', -5n)).toBe(true);
    expect(wallet.getBalance(1, 'BTC').locked).toBe(0n);

    wallet.lock(1, 'BTC', 5n);
    // Negative or zero unlock should have no effect
    wallet.unlock(1, 'BTC', 0n);
    wallet.unlock(1, 'BTC', -2n);
    expect(wallet.getBalance(1, 'BTC').locked).toBe(5n);

    // Negative or zero debitLocked should succeed and have no effect
    expect(wallet.debitLocked(1, 'BTC', 0n)).toBe(true);
    expect(wallet.debitLocked(1, 'BTC', -3n)).toBe(true);
    expect(wallet.getBalance(1, 'BTC').locked).toBe(5n);
  });
});
