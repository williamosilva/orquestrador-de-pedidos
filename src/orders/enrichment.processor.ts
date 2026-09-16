import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue, UnrecoverableError } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { Logger } from 'pino';
import { runWithCorrelation } from '../common/logger/correlation.store';
import { backoffWithJitter } from '../queue/backoff';
import { ENRICHMENT_DLQ, ENRICHMENT_QUEUE, EnrichmentJob } from '../queue/queues';
import { EnrichmentService } from './enrichment.service';
import { OrderStatus } from './order-status.enum';
import { OrdersRepository } from './orders.repository';
import { EnrichmentError } from './providers/enrichment-provider.interface';
import { ExternalApiException } from './providers/external-api.exception';

@Processor(ENRICHMENT_QUEUE, {
  concurrency: 5,
  settings: { backoffStrategy: (attemptsMade: number) => backoffWithJitter(attemptsMade) },
})
export class EnrichmentProcessor extends WorkerHost {
  private readonly log: Logger;

  constructor(
    private readonly enrichment: EnrichmentService,
    private readonly repo: OrdersRepository,
    @InjectQueue(ENRICHMENT_DLQ) private readonly dlq: Queue,
    pino: PinoLogger,
  ) {
    super();

    this.log = pino.logger.child({ context: EnrichmentProcessor.name });
  }

  async process(job: Job<EnrichmentJob>): Promise<void> {
    const correlationId = correlationOf(job);
    const attempt = job.attemptsMade + 1;

    return runWithCorrelation(correlationId, async () => {
      this.log.info(
        { correlationId, orderId: job.data.orderId, jobId: job.id, attempt },
        'enriquecimento iniciado',
      );

      try {
        await this.enrichment.enrich(job.data.orderId);
      } catch (err) {
        if (err instanceof ExternalApiException) err.meta.attempt = attempt;

        // UnrecoverableError corta as tentativas restantes. insistir 4 vezes num sku que
        // não existe queima recurso pra chegar na mesma resposta
        if (err instanceof EnrichmentError && !err.retryable) {
          throw new UnrecoverableError(err.message);
        }

        throw err;
      }

      this.log.info(
        { correlationId, orderId: job.data.orderId, attempt },
        'enriquecimento concluido',
      );
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<EnrichmentJob>, err: Error): Promise<void> {
    const correlationId = correlationOf(job);
    const meta = err instanceof ExternalApiException ? err.meta : {};
    const esgotou = job.attemptsMade >= (job.opts.attempts ?? 1);

    this.log.warn(
      { correlationId, orderId: job.data.orderId, attempt: job.attemptsMade, ...meta },
      `tentativa ${job.attemptsMade} falhou: ${err.message}`,
    );

    if (!esgotou && !(err instanceof UnrecoverableError)) return;

    const order = await this.repo.findById(job.data.orderId);

    // banco antes da dlq: ele é a fonte de verdade, o registro da dlq é artefato de
    // auditoria. só marca FAILED quem chegou a entrar em ENRICHING, falha antes disso
    // (pedido inexistente, banco fora) não inventa estado e deixa pra reconciliação
    if (order?.status === OrderStatus.ENRICHING) {
      order.markFailed(err.message);
      await this.repo.save(order);
    }

    await this.dlq.add('enrich-failed', {
      orderId: job.data.orderId,
      correlationId,
      payload: job.data,
      attempts: job.attemptsMade,
      errorChain: job.stacktrace?.map((linha) => linha.split('\n')[0]) ?? [err.message],
      failedAt: new Date().toISOString(),
      provider: order?.source ?? null,
    });

    this.log.error(
      { correlationId, orderId: job.data.orderId, attempts: job.attemptsMade, ...meta },
      `pedido foi pra dlq: ${err.message}`,
    );
  }
}

// job sem correlation (reprocesso manual da dlq) cai pro jobId, que é a idempotency_key
// e serve de chave de grep do mesmo jeito
function correlationOf(job: Job<EnrichmentJob>): string {
  return job.data.correlationId ?? job.id ?? '-';
}
