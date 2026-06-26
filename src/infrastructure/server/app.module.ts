import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EngineService } from './engine.service';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { WalletController } from './wallet/wallet.controller';
import { TradingGateway } from './trading/trading.gateway';
import { MetricsService } from './metrics/metrics.service';
import { MetricsController } from './metrics/metrics.controller';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: 'apex_trade_secret_key_123_high_performance',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController, WalletController, MetricsController],
  providers: [EngineService, AuthService, TradingGateway, MetricsService],
})
export class AppModule {}
