import { EnrichmentError } from './enrichment-provider.interface';

export type ExternalApiMeta = {
  provider: string;
  sku: string;
  url: string;
  httpStatus?: number;
  latencyMs: number;
  // o provider não tem como saber em qual tentativa da fila ele está rodando, então o
  // worker estampa isso na hora de logar e de montar o registro da dlq
  attempt?: number;
};

export class ExternalApiException extends EnrichmentError {
  constructor(
    message: string,
    retryable: boolean,
    readonly meta: ExternalApiMeta,
  ) {
    super(message, retryable);
  }
}
