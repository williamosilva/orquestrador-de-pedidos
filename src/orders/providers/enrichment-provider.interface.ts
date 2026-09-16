export const ENRICHMENT_PROVIDERS = Symbol('EnrichmentProviders');

export type EnrichedItem = {
  sku: string;
  productName: string;
  discountPercentage: number;
};

export interface EnrichmentProvider {
  supports(source: string): boolean;
  enrich(items: { sku: string }[]): Promise<EnrichedItem[]>;
}

// retryable viaja no erro porque quem sabe se vale tentar de novo é quem fez a chamada,
// nao o worker. ele so traduz isso pro vocabulario da fila
export class EnrichmentError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
