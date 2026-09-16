import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from './order-status.enum';
import { calculateTotals } from './order-totals';
import { Order } from './entities/order.entity';
import { ExchangeRateService } from './exchange-rate.service';
import { OrdersRepository } from './orders.repository';
import { EnrichmentError } from './providers/enrichment-provider.interface';
import { ProviderFactory } from './providers/provider.factory';

@Injectable()
export class EnrichmentService {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly factory: ProviderFactory,
    private readonly exchange: ExchangeRateService,
    private readonly cfg: ConfigService,
  ) {}

  async enrich(orderId: string): Promise<void> {
    const order = await this.repo.findById(orderId);

    if (!order) throw new EnrichmentError(`pedido ${orderId} nao existe`, false);

    // a fila entrega at least once e o job sobrevive ao removeOnComplete por 1h, então
    // pedido que já terminou não pode voltar pra bancada
    if (order.status === OrderStatus.ENRICHED) return;

    order.startEnrichment();
    await this.repo.save(order);

    const provider = this.factory.resolve(order.source);
    const enriched = await provider.enrich(order.items.map(({ sku }) => ({ sku })));

    for (const item of order.items) {
      const dados = enriched.find((e) => e.sku === item.sku);

      if (!dados) throw new EnrichmentError(`provider nao devolveu o sku ${item.sku}`, false);

      item.applyEnrichment(dados.productName, dados.discountPercentage);
    }

    order.markEnriched(calculateTotals(order.items));
    await this.converter(order);

    await this.repo.save(order);
  }

  private async converter(order: Order): Promise<void> {
    const alvo = this.cfg.getOrThrow<string>('CONVERSION_TARGET_CURRENCY');

    // pedido que já está na moeda de relatório não gasta chamada externa nenhuma
    if (order.currency === alvo) return;

    const cotacao = await this.exchange.buscar(order.currency, alvo);

    if (!cotacao) return;

    order.applyConversion(cotacao.rate, cotacao.rateDate);
  }
}
