import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { Queue, QueueEvents } from 'bullmq';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ENRICHMENT_DLQ, ENRICHMENT_QUEUE } from '../src/queue/queues';
import { validationPipe } from '../src/common/config/validation.config';

export type Ambiente = {
  app: INestApplication;
  ds: DataSource;
  fila: Queue;
  dlq: Queue;
  eventos: QueueEvents;
  eventosDlq: QueueEvents;
};

const connection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
};

export async function subirAmbiente(
  ajustar: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<Ambiente> {
  const modulo = await ajustar(Test.createTestingModule({ imports: [AppModule] })).compile();

  const app = modulo.createNestApplication({ logger: false });
  app.useGlobalPipes(validationPipe());
  await app.init();

  const eventos = new QueueEvents(ENRICHMENT_QUEUE, { connection });
  const eventosDlq = new QueueEvents(ENRICHMENT_DLQ, { connection });

  await Promise.all([eventos.waitUntilReady(), eventosDlq.waitUntilReady()]);

  return {
    app,
    ds: app.get(DataSource),
    fila: new Queue(ENRICHMENT_QUEUE, { connection }),
    dlq: new Queue(ENRICHMENT_DLQ, { connection }),
    eventos,
    eventosDlq,
  };
}

// apaga as filas ANTES de despausar. o contrário solta o worker em cima de um job que
// vai ser apagado no instante seguinte, e o bullmq reclama de chave faltando no retry
export async function limpar(amb: Ambiente): Promise<void> {
  await Promise.all([amb.fila.obliterate({ force: true }), amb.dlq.obliterate({ force: true })]);
  await amb.fila.resume();
  await amb.ds.query('truncate table orders cascade');
}

// app primeiro: fechar o app derruba o worker, e worker vivo com o cliente de fila
// fechado embaixo dele gera erro de conexão no meio do teardown
export async function derrubar(amb: Ambiente): Promise<void> {
  await amb.app.close();

  await Promise.all([
    amb.eventos.close(),
    amb.eventosDlq.close(),
    amb.fila.close(),
    amb.dlq.close(),
  ]);
}

// resolve no evento de job entrando na dlq, sem polling e sem sleep. o worker grava o
// banco antes de publicar na dlq, então quando isso resolve o pedido já está consistente
export function esperarDlq(amb: Ambiente): Promise<void> {
  return new Promise((resolve) => {
    amb.eventosDlq.once('added', () => resolve());
  });
}
