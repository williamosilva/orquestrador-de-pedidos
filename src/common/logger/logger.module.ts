import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { LoggerModule as PinoModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        pinoHttp: {
          level: cfg.get<string>('LOG_LEVEL'),
          // reaproveita o id do emissor qnd ele manda um, senao gera. é esse mesmo id
          // que vai viajar dentro do payload do job pro worker restaurar depois
          genReqId: (req: IncomingMessage, res: ServerResponse) => {
            const id = (req.headers['x-correlation-id'] as string) || randomUUID();
            res.setHeader('x-correlation-id', id);
            return id;
          },
          redact: {
            paths: ['req.headers.authorization', 'req.body.customer.email'],
            censor: '[redacted]',
          },
          // pretty só em dev, em prod o log tem que sair em json puro pra ser indexável
          transport:
            cfg.get<string>('NODE_ENV') === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
  ],
  exports: [PinoModule],
})
export class LoggerModule {}
