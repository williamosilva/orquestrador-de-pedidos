import { OrderStatus } from '../order-status.enum';
import { IllegalStatusTransition, Order } from './order.entity';
import { calculateTotals } from '../order-totals';

function orderWith(status: OrderStatus): Order {
  const order = new Order();

  order.idempotencyKey = 'loja-da-ana-8842';
  order.customerName = 'Ana Silva';
  order.status = status;

  return order;
}

const totals = calculateTotals([{ qty: 2, unitPrice: 89.9, discountPercentage: 10 }]);

describe('maquina de estados do pedido', () => {
  it('comeca o enriquecimento a partir de RECEIVED', () => {
    const order = orderWith(OrderStatus.RECEIVED);

    order.startEnrichment();

    expect(order.status).toBe(OrderStatus.ENRICHING);
  });

  it('aceita reentrar em ENRICHING porque a fila entrega at least once', () => {
    const order = orderWith(OrderStatus.ENRICHING);

    expect(() => order.startEnrichment()).not.toThrow();
    expect(order.status).toBe(OrderStatus.ENRICHING);
  });

  it('grava totais e enriched_at ao concluir', () => {
    const order = orderWith(OrderStatus.ENRICHING);

    order.markEnriched(totals);

    expect(order.status).toBe(OrderStatus.ENRICHED);
    expect(order.subtotal).toBe(179.8);
    expect(order.discountTotal).toBe(17.98);
    expect(order.total).toBe(161.82);
    expect(order.enrichedAt).toBeInstanceOf(Date);
  });

  it('guarda o motivo ao falhar', () => {
    const order = orderWith(OrderStatus.ENRICHING);

    order.markFailed('sku DJ-99999 nao existe no catalogo');

    expect(order.status).toBe(OrderStatus.FAILED_ENRICHMENT);
    expect(order.failureReason).toBe('sku DJ-99999 nao existe no catalogo');
  });

  it('nao deixa pular de RECEIVED direto pra ENRICHED', () => {
    const order = orderWith(OrderStatus.RECEIVED);

    expect(() => order.markEnriched(totals)).toThrow(IllegalStatusTransition);
    expect(order.status).toBe(OrderStatus.RECEIVED);
  });

  it('nao reprocessa pedido ja enriquecido', () => {
    const order = orderWith(OrderStatus.ENRICHED);

    expect(() => order.startEnrichment()).toThrow(IllegalStatusTransition);
    expect(() => order.markFailed('timeout no provedor')).toThrow(IllegalStatusTransition);
  });

  it('deixa reprocessar na mao o pedido que caiu na dlq', () => {
    const order = orderWith(OrderStatus.FAILED_ENRICHMENT);

    order.startEnrichment();

    expect(order.status).toBe(OrderStatus.ENRICHING);
  });

  it('limpa o motivo da falha quando o reprocesso da dlq da certo', () => {
    const order = orderWith(OrderStatus.ENRICHING);
    order.failureReason = 'dummyjson nao respondeu (ENOTFOUND) para o sku DJ-15';

    order.markEnriched(totals);

    expect(order.failureReason).toBeNull();
  });

  it('nao deixa a dlq pular direto pra ENRICHED sem passar pelo worker', () => {
    const order = orderWith(OrderStatus.FAILED_ENRICHMENT);

    expect(() => order.markEnriched(totals)).toThrow(IllegalStatusTransition);
  });

  it('grava a conversao a partir do proprio total, sem mexer no status', () => {
    const order = orderWith(OrderStatus.ENRICHING);

    order.markEnriched(totals);
    order.applyConversion(5.1512, '2026-09-15');

    expect(order.total).toBe(161.82);
    expect(order.exchangeRate).toBe(5.1512);
    expect(order.rateDate).toBe('2026-09-15');
    expect(order.convertedTotal).toBe(833.57);
    expect(order.status).toBe(OrderStatus.ENRICHED);
  });
});
