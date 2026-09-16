import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';

// a CLI do typeorm não sobe o container do nest, então ela precisa do próprio datasource.
// duplica um pedaço do database.config mas é o caminho suportado pela lib
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '..', '..', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', '..', 'migrations', '*.{ts,js}')],
});
