import request from 'supertest';
import { OrderStatus } from '../src/orders/order-status.enum';
import { Order } from '../src/orders/entities/order.entity';
import { EnrichmentError } from '../src/orders/providers/enrichment-provider.interface';
import { DummyJsonProvider } from '../src/orders/providers/dummyjson.provider';
import { Ambiente, derrubar, esperarDlq, limpar, subirAmbiente } from './app-e2e';

const TIMEOUT_RETENTATIVAS = 60_000;

function payload(extra: Record<string, unknown>) {
  return {
    order_id: 'ext-e2e-4502',
    idempotency_key: 'atelie-mara-4502',
    currency: 'USD',
    customer: { name: 'Rafael Moreira', email: 'rafael.moreira@email.com' },
    items: [{ sku: 'IC-1', qty: 1, unit_price: 129.9 }],
    ...extra,
  };
}

describe('caminho triste do enriquecimento (e2e)', () => {
  let amb: Ambiente;

  beforeAll(async () => {
    // o provider http entra dublado e sempre falhando: quem está sob teste aqui é a
    // maquinaria de retry e dlq, não o dummyjson. assim a suíte roda offline e sem flaky
    amb = await subirAmbiente((builder) =>
      builder.overrideProvider(DummyJsonProvider).useValue({
        supports: (source: string) => source === 'dummyjson',
        enrich: () => Promise.reject(new EnrichmentError('provedor fora do ar', true)),
      }),
    );
  });

  beforeEach(async () => {
    await limpar(amb);
  });

  afterAll(async () => {
    await derrubar(amb);
  });

  it(
    'gasta as 4 tentativas e cai na dlq com FAILED_ENRICHMENT',
    async () => {
      const naDlq = esperarDlq(amb);

      const res = await request(amb.app.getHttpServer())
        .post('/webhooks/orders')
        .send(payload({ source: 'dummyjson', items: [{ sku: 'DJ-1', qty: 1, unit_price: 129.9 }] }))
        .set('x-correlation-id', 'e2e-caminho-triste')
        .expect(202);

      await naDlq;

      const pedido = await amb.ds.getRepository(Order).findOneByOrFail({ id: res.body.id });

      expect(pedido.status).toBe(OrderStatus.FAILED_ENRICHMENT);
      expect(pedido.failureReason).toBe('provedor fora do ar');
      expect(pedido.enrichedAt).toBeNull();

      const [registro] = await amb.dlq.getJobs(['waiting']);

      expect(registro.data.orderId).toBe(res.body.id);
      expect(registro.data.attempts).toBe(4);
      expect(registro.data.errorChain).toHaveLength(4);
      expect(registro.data.correlationId).toBe('e2e-caminho-triste');
      expect(registro.data.provider).toBe('dummyjson');
    },
    TIMEOUT_RETENTATIVAS,
  );

  it('manda sku inexistente pra dlq na primeira tentativa, sem gastar retry', async () => {
    const naDlq = esperarDlq(amb);

    const res = await request(amb.app.getHttpServer())
      .post('/webhooks/orders')
      .send(
        payload({
          source: 'internal-catalog',
          items: [{ sku: 'IC-99', qty: 1, unit_price: 19.9 }],
        }),
      )
      .expect(202);

    await naDlq;

    const pedido = await amb.ds.getRepository(Order).findOneByOrFail({ id: res.body.id });

    expect(pedido.status).toBe(OrderStatus.FAILED_ENRICHMENT);
    expect(pedido.failureReason).toMatch(/IC-99 nao existe no catalogo local/);

    const [registro] = await amb.dlq.getJobs(['waiting']);

    expect(registro.data.attempts).toBe(1);
    expect(registro.data.errorChain).toHaveLength(1);
  });
});
