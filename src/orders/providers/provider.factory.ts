import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { currentCorrelationId } from '../../common/logger/correlation.store';
import {
  ENRICHMENT_PROVIDERS,
  EnrichmentError,
  EnrichmentProvider,
} from './enrichment-provider.interface';

@Injectable()
export class ProviderFactory {
  constructor(
    @Inject(ENRICHMENT_PROVIDERS) private readonly providers: EnrichmentProvider[],
    private readonly cfg: ConfigService,
    private readonly pino: PinoLogger,
  ) {}

  // resolve pelo primeiro supports() que casar. e-commerce novo = classe nova registrada
  // no módulo, sem ninguém editar um switch que cresce pra sempre
  resolve(source: string): EnrichmentProvider {
    const provider = this.providers.find((p) => p.supports(source));

    if (provider) return provider;

    const fallback = this.cfg.getOrThrow<string>('ENRICHMENT_DEFAULT_SOURCE');
    const padrao = this.providers.find((p) => p.supports(fallback));

    if (!padrao) throw new EnrichmentError(`nenhum provider atende o source ${source}`, false);

    // cair no default é decisao aprovada, mas em silêncio um typo no source vira pedido
    // enriquecido pelo provedor errado e ninguém fica sabendo
    this.pino.warn(
      {
        context: ProviderFactory.name,
        correlationId: currentCorrelationId() ?? null,
        source,
        fallback,
      },
      `nenhum provider atende o source ${source}, caindo no default ${fallback}`,
    );

    return padrao;
  }
}
