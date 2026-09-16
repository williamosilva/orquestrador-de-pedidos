import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { PinoLogger } from 'nestjs-pino';
import { firstValueFrom } from 'rxjs';
import { currentCorrelationId } from '../common/logger/correlation.store';

export type Cotacao = { rate: number; rateDate: string };

type Resposta = { date: string; rates: Record<string, number> };

// classe concreta, sem interface: fonte de cotacao é uma so. o catalogo tem interface porque
// um dia entra Shopify, VTEX, NuvemShop; aqui seria cerimonia
@Injectable()
export class ExchangeRateService {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly pino: PinoLogger,
    cfg: ConfigService,
  ) {
    this.baseUrl = cfg.getOrThrow<string>('EXCHANGE_BASE_URL');
  }

  // devolve null em vez de lançar, de propósito: o valor convertido é dado derivado e não
  // pode derrubar um enriquecimento que deu certo. cotação que faltou hoje da pra buscar
  // depois, mas pedido jogado na dlq por isso seria trabalho bom descartado
  async buscar(de: string, para: string): Promise<Cotacao | null> {
    const url = `${this.baseUrl}/latest?from=${de}&to=${para}`;

    try {
      const { data } = await firstValueFrom(this.http.get<Resposta>(url));
      const rate = data?.rates?.[para];

      if (typeof rate !== 'number' || typeof data.date !== 'string') {
        return this.desistir(de, para, `resposta sem cotacao de ${de} para ${para}`);
      }

      return { rate, rateDate: data.date };
    } catch (err) {
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;

      return this.desistir(
        de,
        para,
        status ? `respondeu ${status}` : `nao respondeu (${axiosErr.code ?? 'erro de rede'})`,
      );
    }
  }

  private desistir(de: string, para: string, motivo: string): null {
    this.pino.warn(
      {
        context: ExchangeRateService.name,
        correlationId: currentCorrelationId() ?? null,
        from: de,
        to: para,
        motivo,
      },
      `cotacao ${de}-${para} indisponivel, pedido segue sem valor convertido`,
    );

    return null;
  }
}
