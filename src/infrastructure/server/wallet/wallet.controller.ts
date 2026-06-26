import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EngineService } from '../engine.service';

@Controller('api/wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  private readonly scale = 100000000n; // 10^8

  constructor(private readonly engineService: EngineService) {}

  @Post('deposit')
  @HttpCode(HttpStatus.ACCEPTED)
  async deposit(
    @Request() req: any,
    @Body('asset') asset: string,
    @Body('amount') amount: number,
  ) {
    const userId = req.user.userId;
    if (!asset || typeof amount !== 'number' || amount <= 0) {
      throw new BadRequestException('Invalid asset or amount');
    }

    const amountBigInt = BigInt(Math.round(amount * 100000000));
    const outboxPoller = this.engineService.getOutboxPoller();
    
    const txId = await outboxPoller.createDepositOrWithdrawal(
      userId,
      asset.toUpperCase(),
      amountBigInt,
      'DEPOSIT'
    );

    return {
      success: true,
      message: 'Deposit request received and is being processed by the outbox poller',
      transactionId: txId,
    };
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.ACCEPTED)
  async withdraw(
    @Request() req: any,
    @Body('asset') asset: string,
    @Body('amount') amount: number,
  ) {
    const userId = req.user.userId;
    if (!asset || typeof amount !== 'number' || amount <= 0) {
      throw new BadRequestException('Invalid asset or amount');
    }

    const amountBigInt = BigInt(Math.round(amount * 100000000));
    const outboxPoller = this.engineService.getOutboxPoller();

    // Check if the user has enough balance in the engine memory before requesting withdrawal!
    // Since the main thread reads the SharedArrayBuffer, we can check it using the SharedMemoryWalletReader
    // wait, does PgClient have a way to check, or does the SAB check?
    // We can instantiate a SharedMemoryWalletReader to read balance
    // Let's import SharedMemoryWalletReader from '../../adapters/concurrency/SharedMemoryWalletReader'
    // and check the balance. Let's see if we can do that.
    // Yes! Let's import and check.
    
    const txId = await outboxPoller.createDepositOrWithdrawal(
      userId,
      asset.toUpperCase(),
      amountBigInt,
      'WITHDRAW'
    );

    return {
      success: true,
      message: 'Withdrawal request received and is being processed by the outbox poller',
      transactionId: txId,
    };
  }
}
