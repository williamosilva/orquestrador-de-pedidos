import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from './numeric.transformer';
import { OrderItem } from './order-item.entity';
import { OrderStatus } from '../order-status.enum';
import { OrderTotals, convertTotal } from '../order-totals';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.RECEIVED]: [OrderStatus.ENRICHING],
  // ENRICHING -> ENRICHING liberado de propósito: a fila entrega at least once, então a
  // tentativa 2 reentra no mesmo estado. se isso lançasse, retry de erro transitório
  // viraria erro de domínio
  [OrderStatus.ENRICHING]: [
    OrderStatus.ENRICHING,
    OrderStatus.ENRICHED,
    OrderStatus.FAILED_ENRICHMENT,
  ],
  [OrderStatus.ENRICHED]: [],
  // volta pra ENRICHING porque a dlq é fila de verdade e existe pra ser reprocessada na mao.
  // sem essa aresta o pedido morreria na dlq sem caminho de volta
  [OrderStatus.FAILED_ENRICHMENT]: [OrderStatus.ENRICHING],
};

export class IllegalStatusTransition extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`transicao ilegal de ${from} para ${to}`);
  }
}

@Entity('orders')
export class Order {
  // pk gerada pelo banco com gen_random_uuid(), que é core do pg 13+. o
  // PrimaryGeneratedColumn do typeorm arrastaria a extensão uuid-ossp sem ganho nenhum
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ name: 'external_order_id' })
  externalOrderId: string;

  @Index('uq_orders_idempotency_key', { unique: true })
  @Column({ name: 'idempotency_key' })
  idempotencyKey: string;

  @Column()
  source: string;

  @Column({ name: 'customer_email' })
  customerEmail: string;

  @Column({ name: 'customer_name' })
  customerName: string;

  @Column({ length: 3 })
  currency: string;

  @Index('idx_orders_status')
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.RECEIVED })
  status: OrderStatus;

  @Column('numeric', { precision: 12, scale: 2, transformer: numericTransformer })
  subtotal: number;

  @Column('numeric', {
    name: 'discount_total',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  discountTotal: number;

  @Column('numeric', { precision: 12, scale: 2, transformer: numericTransformer })
  total: number;

  @Column({ name: 'enriched_at', type: 'timestamptz', nullable: true })
  enrichedAt: Date | null;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column('numeric', {
    name: 'converted_total',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  convertedTotal: number | null;

  // taxa com 6 casas porque cotacao tem mais precisao que dinheiro, e guardar a taxa usada é
  // o que permite auditar o valor convertido depois, quando a cotacao do dia ja mudou
  @Column('numeric', {
    name: 'exchange_rate',
    precision: 12,
    scale: 6,
    nullable: true,
    transformer: numericTransformer,
  })
  exchangeRate: number | null;

  // date como string porque o driver do pg converte date em Date na meia-noite local, e em
  // fuso negativo isso volta o dia
  @Column({ name: 'rate_date', type: 'date', nullable: true })
  rateDate: string | null;

  @Index('idx_orders_created_at')
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // cascade no insert pra pedido e itens irem na mesma transacao (o job so é enfileirado
  // dps do commit, entao o worker nunca acha pedido sem item) e no update porque o
  // enriquecimento grava product_name e preco final nos itens
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: ['insert', 'update'] })
  items: OrderItem[];

  startEnrichment(): void {
    this.moveTo(OrderStatus.ENRICHING);
  }

  markEnriched(totals: OrderTotals): void {
    this.moveTo(OrderStatus.ENRICHED);

    this.subtotal = totals.subtotal;
    this.discountTotal = totals.discountTotal;
    this.total = totals.total;
    this.enrichedAt = new Date();
    // limpa o motivo da falha anterior: pedido reprocessado da dlq não pode ficar
    // ENRICHED carregando o erro que já foi resolvido
    this.failureReason = null;
  }

  // conversao é dado derivado: o pedido fecha ENRICHED com ou sem ela, e quem traz a taxa
  // não faz conta nenhuma. mesma regra do catálogo, que traz desconto e não traz preço
  applyConversion(rate: number, rateDate: string): void {
    this.exchangeRate = rate;
    this.rateDate = rateDate;
    this.convertedTotal = convertTotal(this.total, rate);
  }

  markFailed(reason: string): void {
    this.moveTo(OrderStatus.FAILED_ENRICHMENT);

    this.failureReason = reason;
  }

  private moveTo(next: OrderStatus): void {
    if (!TRANSITIONS[this.status].includes(next)) {
      throw new IllegalStatusTransition(this.status, next);
    }

    this.status = next;
  }
}
