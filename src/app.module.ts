import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from './orders/orders.module';
import { QueueModule } from './queue/queue.module';
import { databaseConfig } from './common/config/database.config';
import { envSchema } from './common/config/env.schema';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerModule } from './common/logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
      // abortEarly false pra ver todos os erros de env de uma vez, senão vira um
      // restart pra cada variável faltando
      validationOptions: { abortEarly: false },
    }),
    LoggerModule,
    OrdersModule,
    QueueModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
