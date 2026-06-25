import { Wallet } from '../../domain/entities/Wallet';

export class DepositUseCase {
  private wallet: Wallet;

  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  public execute(userId: number, asset: string, amount: bigint): void {
    this.wallet.credit(userId, asset, amount);
  }
}
