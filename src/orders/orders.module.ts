import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpLatencyInterceptor } from '../common/interceptors/http-latency.interceptor';
import { LoggerModule } from '../common/logger/logger.module';
import { QueueModule } from '../queue/queue.module';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { EnrichmentProcessor } from './enrichment.processor';
import { EnrichmentService } from './enrichment.service';
import { ExchangeRateService } from './exchange-rate.service';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';
import { OrdersWebhookController } from './orders-webhook.controller';
import { DummyJsonProvider } from './providers/dummyjson.provider';
import { ENRICHMENT_PROVIDERS } from './providers/enrichment-provider.interface';
import { InternalCatalogProvider } from './providers/internal-catalog.provider';
import { ProviderFactory } from './providers/provider.factory';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    QueueModule,
    LoggerModule,
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        timeout: cfg.getOrThrow<number>('ENRICHMENT_TIMEOUT_MS'),
      }),
    }),
  ],
  controllers: [OrdersWebhookController, OrdersController],
  providers: [
    OrdersService,
    OrdersRepository,
    EnrichmentService,
    ExchangeRateService,
    EnrichmentProcessor,
    ProviderFactory,
    HttpLatencyInterceptor,
    DummyJsonProvider,
    InternalCatalogProvider,
    // e-commerce novo = criar a classe e registrar aqui. a factory resolve pelo
    // supports() e ninguém precisa editar switch
    {
      provide: ENRICHMENT_PROVIDERS,
      inject: [DummyJsonProvider, InternalCatalogProvider],
      useFactory: (dummyjson: DummyJsonProvider, catalogo: InternalCatalogProvider) => [
        dummyjson,
        catalogo,
      ],
    },
  ],
})
export class OrdersModule {}
