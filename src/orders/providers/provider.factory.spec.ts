import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { EnrichedItem, EnrichmentError, EnrichmentProvider } from './enrichment-provider.interface';
import { ProviderFactory } from './provider.factory';

class ProviderFalso implements EnrichmentProvider {
  constructor(private readonly source: string) {}

  supports(source: string): boolean {
    return source === this.source;
  }

  async enrich(): Promise<EnrichedItem[]> {
    return [];
  }
}

const avisos: Record<string, unknown>[] = [];

function factory(providers: EnrichmentProvider[], padrao: string): ProviderFactory {
  const cfg = { getOrThrow: () => padrao } as unknown as ConfigService;
  const pino = {
    warn: (obj: { source: string; fallback: string }) => avisos.push(obj),
  } as unknown as PinoLogger;

  return new ProviderFactory(providers, cfg, pino);
}

const dummyjson = new ProviderFalso('dummyjson');
const catalogo = new ProviderFalso('internal-catalog');

describe('ProviderFactory', () => {
  beforeEach(() => {
    avisos.length = 0;
  });

  it('resolve pelo primeiro supports que casar', () => {
    const resolvida = factory([dummyjson, catalogo], 'dummyjson');

    expect(resolvida.resolve('internal-catalog')).toBe(catalogo);
    expect(resolvida.resolve('dummyjson')).toBe(dummyjson);
  });

  it('cai no default do ambiente quando o source e desconhecido', () => {
    const resolvida = factory([dummyjson, catalogo], 'internal-catalog');

    expect(resolvida.resolve('shopify')).toBe(catalogo);
  });

  it('avisa no log ao cair no default, pra typo no source nao passar batido', () => {
    const resolvida = factory([dummyjson, catalogo], 'internal-catalog');

    resolvida.resolve('dummyjson');
    expect(avisos).toHaveLength(0);

    resolvida.resolve('shopfy');
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ source: 'shopfy', fallback: 'internal-catalog' });
  });

  it('lanca erro nao-retryable quando nem o default atende', () => {
    const resolvida = factory([dummyjson], 'nuvemshop');

    expect(() => resolvida.resolve('shopify')).toThrow(EnrichmentError);
    expect(() => resolvida.resolve('shopify')).toThrow(/nenhum provider atende/);
  });

  it('nao retenta quando o provider nao existe: mudar isso exige deploy, nao tentativa', () => {
    const resolvida = factory([dummyjson], 'nuvemshop');

    try {
      resolvida.resolve('shopify');
      fail('deveria ter lancado');
    } catch (err) {
      expect((err as EnrichmentError).retryable).toBe(false);
    }
  });
});
