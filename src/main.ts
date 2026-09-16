import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { validationPipe } from './common/config/validation.config';

async function bootstrap() {
  // bufferLogs segura o log do boot até o pino estar de pe, senão os primeiros
  // logs saem no formato feio do nest e fora do json
  const app = await NestFactory.create(AppModule, { bufferLogs: true, abortOnError: false });
  app.useLogger(app.get(Logger));

  app.useGlobalPipes(validationPipe());

  // tem que vir antes do listen, senão o worker do bull não recebe o SIGTERM e o
  // deploy mata job no meio
  app.enableShutdownHooks();

  const docs = new DocumentBuilder()
    .setTitle('Orquestrador de Pedidos')
    .setDescription(
      'Teste técnico Inbazz.\n\n' +
        'Recebe pedidos por webhook com idempotência garantida, enfileira, enriquece via ' +
        'provedor externo com retry, backoff e DLQ, e expõe consulta.',
    )
    .setVersion('1.0')
    .addTag('webhooks', 'entrada de pedidos, idempotente por idempotency_key')
    .addTag('orders', 'consulta de pedidos e itens')
    .addTag('queue', 'estado da fila de enriquecimento e da DLQ')
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, docs));

  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}

bootstrap().catch((err: Error) => {
  // com abortOnError false o nest devolve o erro pra ca em vez de cuspir o stack trace
  // dele. falha de boot (postgres fora do ar, env inválida) tem que sair em uma linha,
  // 40 linhas de stack não ajudam ninguém a ver que o banco não subiu
  console.error(`falha ao subir a aplicacao: ${err.message}`);
  process.exit(1);
});
