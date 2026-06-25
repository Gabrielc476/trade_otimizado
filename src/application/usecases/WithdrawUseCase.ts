import { Wallet } from '../../domain/entities/Wallet';

export class WithdrawUseCase {
  private wallet: Wallet;

  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  public execute(userId: number, asset: string, amount: bigint): boolean {
    return this.wallet.debit(userId, asset, amount);
  }
}
