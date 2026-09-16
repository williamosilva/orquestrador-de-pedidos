import request from 'supertest';
import { OrderStatus } from '../src/orders/order-status.enum';
import { Order } from '../src/orders/entities/order.entity';
import { Ambiente, derrubar, limpar, subirAmbiente } from './app-e2e';

// sem source no payload de propósito: cai no ENRICHMENT_DEFAULT_SOURCE do .env.test,
// que é o catálogo interno. dublê determinístico, e2e sem depender de internet
const payload = {
  order_id: 'ext-e2e-4501',
  idempotency_key: 'loja-da-ana-4501',
  currency: 'USD',
  customer: { name: 'Ana Silva', email: 'ana.silva@email.com' },
  items: [
    { sku: 'IC-1', qty: 2, unit_price: 89.9 },
    { sku: 'IC-2', qty: 1, unit_price: 59.9 },
  ],
};

describe('webhook ate o worker (e2e)', () => {
  let amb: Ambiente;

  beforeAll(async () => {
    amb = await subirAmbiente();
  });

  beforeEach(async () => {
    await limpar(amb);
  });

  afterAll(async () => {
    await derrubar(amb);
  });

  it('leva o pedido de RECEIVED a ENRICHED com os totais recalculados', async () => {
    // pausar a fila antes do post é o que torna a leitura de RECEIVED determinística:
    // sem isso o worker pode terminar antes da asserção e o teste vira corrida
    await amb.fila.pause();

    const res = await request(amb.app.getHttpServer())
      .post('/webhooks/orders')
      .send(payload)
      .expect(202);

    expect(res.body.status).toBe(OrderStatus.RECEIVED);

    const repo = amb.ds.getRepository(Order);
    const recebido = await repo.findOneByOrFail({ id: res.body.id });

    expect(recebido.status).toBe(OrderStatus.RECEIVED);
    expect(recebido.source).toBe('internal-catalog');
    expect(recebido.subtotal).toBe(239.7);
    expect(recebido.total).toBe(239.7);

    const job = await amb.fila.getJob(payload.idempotency_key);

    expect(job).toBeDefined();

    await amb.fila.resume();
    await job!.waitUntilFinished(amb.eventos);

    const enriquecido = await repo.findOneOrFail({
      where: { id: res.body.id },
      relations: { items: true },
    });

    expect(enriquecido.status).toBe(OrderStatus.ENRICHED);
    expect(enriquecido.enrichedAt).not.toBeNull();
    expect(enriquecido.failureReason).toBeNull();
    expect(enriquecido.subtotal).toBe(239.7);
    expect(enriquecido.discountTotal).toBe(20.97);
    expect(enriquecido.total).toBe(218.73);

    const porSku = [...enriquecido.items].sort((a, b) => a.sku.localeCompare(b.sku));

    expect(porSku[0].productName).toBe('Camiseta Preta Oversized');
    expect(porSku[0].discountPercentage).toBe(10);
    expect(porSku[0].finalUnitPrice).toBe(80.91);
    expect(porSku[1].productName).toBe('Caneca Térmica 500ml');
    expect(porSku[1].discountPercentage).toBe(5);
    expect(porSku[1].finalUnitPrice).toBe(56.91);
  });

  it('devolve o pedido existente no replay em vez de criar outro', async () => {
    await amb.fila.pause();

    const primeiro = await request(amb.app.getHttpServer())
      .post('/webhooks/orders')
      .send(payload)
      .expect(202);

    const replay = await request(amb.app.getHttpServer())
      .post('/webhooks/orders')
      .send(payload)
      .expect(200);

    expect(replay.body.id).toBe(primeiro.body.id);
    expect(await amb.ds.getRepository(Order).count()).toBe(1);
  });

  it('dois posts simultaneos com a mesma chave geram 1 pedido e 1 job', async () => {
    await amb.fila.pause();

    const enviar = () => request(amb.app.getHttpServer()).post('/webhooks/orders').send(payload);

    const [a, b] = await Promise.all([enviar(), enviar()]);

    expect([a.status, b.status].sort()).toEqual([200, 202]);
    expect(a.body.id).toBe(b.body.id);
    expect(await amb.ds.getRepository(Order).count()).toBe(1);

    const jobs = await amb.fila.getJobs(['waiting', 'delayed', 'active']);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(payload.idempotency_key);
  });

  it('recusa payload invalido com 422 antes de tocar no banco', async () => {
    await request(amb.app.getHttpServer())
      .post('/webhooks/orders')
      .send({ ...payload, customer: { name: 'Ana Silva', email: 'ana.silva' } })
      .expect(422);

    expect(await amb.ds.getRepository(Order).count()).toBe(0);
  });
});
