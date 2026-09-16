import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueMetricsController } from './queue-metrics.controller';
import { ENRICHMENT_DLQ, ENRICHMENT_QUEUE } from './queues';

const queues = BullModule.registerQueue(
  {
    name: ENRICHMENT_QUEUE,
    defaultJobOptions: {
      attempts: 4,
      // custom porque o exponential nativo nao tem jitter. a progressao vive em backoff.ts
      backoff: { type: 'custom' },
      removeOnComplete: { age: 3600, count: 1000 },
      // histórico de falha fica pra inspeção. redis não pode crescer sem limite, mas
      // completo é barato de descartar, falha não
      removeOnFail: false,
    },
  },
  // dlq não tem worker de propósito: é fila de estacionamento pra alguém olhar e
  // reprocessar na mão, não trabalho pendente
  { name: ENRICHMENT_DLQ },
);

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.getOrThrow<string>('REDIS_HOST'),
          port: cfg.getOrThrow<number>('REDIS_PORT'),
        },
      }),
    }),
    queues,
  ],
  controllers: [QueueMetricsController],
  exports: [queues],
})
export class QueueModule {}
