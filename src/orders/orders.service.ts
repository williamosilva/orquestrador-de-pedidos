import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { ENRICHMENT_QUEUE, EnrichmentJob } from '../queue/queues';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderStatus } from './order-status.enum';
import { calculateTotals } from './order-totals';
import { ListFilter, OrdersRepository } from './orders.repository';

export type ReceiveOrderInput = {
  externalOrderId: string;
  idempotencyKey: string;
  source?: string;
  currency: string;
  correlationId: string;
  customer: { name: string; email: string };
  items: { sku: string; qty: number; unitPrice: number }[];
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    @InjectQueue(ENRICHMENT_QUEUE) private readonly queue: Queue<EnrichmentJob>,
    private readonly cfg: ConfigService,
    private readonly pino: PinoLogger,
  ) {}

  async receive(input: ReceiveOrderInput): Promise<{ order: Order; duplicated: boolean }> {
    const order = new Order();

    order.externalOrderId = input.externalOrderId;
    order.idempotencyKey = input.idempotencyKey;
    order.source = input.source ?? this.cfg.getOrThrow<string>('ENRICHMENT_DEFAULT_SOURCE');
    order.customerEmail = input.customer.email;
    order.customerName = input.customer.name;
    order.currency = input.currency.toUpperCase();
    order.status = OrderStatus.RECEIVED;
    order.enrichedAt = null;
    order.failureReason = null;
    order.items = input.items.map(toItem);

    const totals = calculateTotals(order.items);

    order.subtotal = totals.subtotal;
    order.discountTotal = totals.discountTotal;
    order.total = totals.total;

    // pedido e itens vao na mesma transação (cascade do insert). o enfileiramento vem
    // depois do commit, nunca dentro dele: job entregue antes do commit faz o worker
    // procurar linha que ainda não existe. a janela de commit ok + queue.add falhando
    // fica descoberta de propósito, outbox transacional aqui seria over-engineering
    const saved = await this.repo.create(order);

    // enfileira tb no replay: se o primeiro queue.add tinha falhado, o retry do emissor
    // conserta. o dedup por jobId so vale enquanto o job existe no redis, entao a
    // idempotencia de verdade é o processor checar o status antes de trabalhar
    await this.enqueue(saved.order, input.correlationId);

    return saved;
  }

  async list(filter: ListFilter): Promise<{ rows: Order[]; total: number }> {
    return this.repo.list(filter);
  }

  async findById(id: string): Promise<Order | null> {
    return this.repo.findById(id);
  }

  private async enqueue(order: Order, correlationId: string): Promise<void> {
    await this.queue.add(
      'enrich',
      { orderId: order.id, correlationId },
      { jobId: order.idempotencyKey },
    );

    this.pino.info(
      {
        context: OrdersService.name,
        correlationId,
        orderId: order.id,
        jobId: order.idempotencyKey,
      },
      'job de enriquecimento enfileirado',
    );
  }
}

function toItem(raw: ReceiveOrderInput['items'][number]): OrderItem {
  const item = new OrderItem();

  item.sku = raw.sku;
  item.qty = raw.qty;
  item.unitPrice = raw.unitPrice;
  item.productName = null;
  item.discountPercentage = null;
  item.finalUnitPrice = null;

  return item;
}
