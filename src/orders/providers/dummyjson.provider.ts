import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { EnrichedItem, EnrichmentError, EnrichmentProvider } from './enrichment-provider.interface';
import { ExternalApiException } from './external-api.exception';

type Produto = { title: string; discountPercentage: number };

const SOURCE = 'dummyjson';

@Injectable()
export class DummyJsonProvider implements EnrichmentProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    cfg: ConfigService,
  ) {
    this.baseUrl = cfg.getOrThrow<string>('DUMMYJSON_BASE_URL');
  }

  supports(source: string): boolean {
    return source === SOURCE;
  }

  async enrich(items: { sku: string }[]): Promise<EnrichedItem[]> {
    return Promise.all(items.map(({ sku }) => this.buscar(sku)));
  }

  // sem retry nenhum aqui de proposito: retry é responsabilidade da fila. retry nas duas
  // camadas multiplica (3 x 3 = 9 chamadas) e é erro classico de sistema distribuido.
  // o timeout vem da env porque quem opera precisa apertar isso sem rebuild
  private async buscar(sku: string): Promise<EnrichedItem> {
    const id = sku.startsWith('DJ-') ? sku.slice(3) : null;

    if (!id) throw new EnrichmentError(`sku ${sku} fora do formato DJ-<id>`, false);

    const url = `${this.baseUrl}/products/${id}`;
    const start = Date.now();

    try {
      const { data } = await firstValueFrom(this.http.get<Produto>(url));

      if (typeof data?.title !== 'string' || typeof data?.discountPercentage !== 'number') {
        throw new ExternalApiException(`dummyjson mudou o contrato do produto ${id}`, false, {
          provider: SOURCE,
          sku,
          url,
          httpStatus: HttpStatus.OK,
          latencyMs: Date.now() - start,
        });
      }

      return { sku, productName: data.title, discountPercentage: data.discountPercentage };
    } catch (err) {
      if (err instanceof EnrichmentError) throw err;

      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;
      const motivo = status
        ? `respondeu ${status}`
        : `nao respondeu (${axiosErr.code ?? 'erro de rede'})`;

      throw new ExternalApiException(`dummyjson ${motivo} para o sku ${sku}`, isRetryable(status), {
        provider: SOURCE,
        sku,
        url,
        httpStatus: status,
        latencyMs: Date.now() - start,
      });
    }
  }
}

// sem status na resposta = timeout, reset ou dns, sempre transitório. com status, só 429 e
// 5xx merecem outra tentativa: 404 de sku e 400 de contrato vao responder igual nas 4
export function isRetryable(status?: number): boolean {
  if (status === undefined) return true;

  return status === 429 || status >= 500;
}
