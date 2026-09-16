import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';

export function databaseConfig(cfg: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: cfg.get<string>('DB_HOST'),
    port: cfg.get<number>('DB_PORT'),
    username: cfg.get<string>('DB_USER'),
    password: cfg.get<string>('DB_PASS'),
    database: cfg.get<string>('DB_NAME'),
    autoLoadEntities: true,
    synchronize: false,
    // migrationsRun ligado aqui porque o avaliador precisa subir o projeto num comando so.
    // em prod isso é ruim com multiplas replicas (race no lock de migration)
    // TODO: tirar do boot e virar step de deploy qnd isso escalar horizontalmente
    migrationsRun: true,
    migrations: [join(__dirname, '..', '..', 'migrations', '*.{ts,js}')],
  };
}
