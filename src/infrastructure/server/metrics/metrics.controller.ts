import { Controller, Get, Response } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Response() res: any) {
    res.set('Content-Type', this.metricsService.getRegistry().contentType);
    res.end(await this.metricsService.getRegistry().metrics());
  }
}
