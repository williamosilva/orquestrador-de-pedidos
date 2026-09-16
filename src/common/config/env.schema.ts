import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),

  ENRICHMENT_DEFAULT_SOURCE: Joi.string().default('dummyjson'),
  ENRICHMENT_TIMEOUT_MS: Joi.number().default(3000),
  DUMMYJSON_BASE_URL: Joi.string().uri().default('https://dummyjson.com'),

  EXCHANGE_BASE_URL: Joi.string().uri().default('https://api.frankfurter.app'),
  CONVERSION_TARGET_CURRENCY: Joi.string().length(3).uppercase().default('USD'),
});
