import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EngineService } from './engine.service';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { WalletController } from './wallet/wallet.controller';
import { TradingGateway } from './trading/trading.gateway';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: 'apex_trade_secret_key_123_high_performance',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController, WalletController],
  providers: [EngineService, AuthService, TradingGateway],
})
export class AppModule {}
