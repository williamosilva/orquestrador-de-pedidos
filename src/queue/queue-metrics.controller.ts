import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { ENRICHMENT_DLQ, ENRICHMENT_QUEUE } from './queues';

const contagem = { active: 0, completed: 12, delayed: 0, failed: 2, waiting: 0 };

const EXEMPLO = {
  [ENRICHMENT_QUEUE]: contagem,
  [ENRICHMENT_DLQ]: { ...contagem, completed: 0, failed: 0, waiting: 2 },
};

@ApiTags('queue')
@Controller('queue')
export class QueueMetricsController {
  constructor(
    @InjectQueue(ENRICHMENT_QUEUE) private readonly enrichment: Queue,
    @InjectQueue(ENRICHMENT_DLQ) private readonly dlq: Queue,
  ) {}

  @Get('metrics')
  @ApiOkResponse({ description: 'getJobCounts das duas filas', schema: { example: EXEMPLO } })
  async metrics() {
    const [enrichment, dlq] = await Promise.all([
      this.enrichment.getJobCounts(),
      this.dlq.getJobCounts(),
    ]);

    return { [ENRICHMENT_QUEUE]: enrichment, [ENRICHMENT_DLQ]: dlq };
  }
}
