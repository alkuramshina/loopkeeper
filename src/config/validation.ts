import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  FRONTEND_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000'),

  DATABASE_URL: Joi.string().uri().required(),

  THROTTLE_TTL: Joi.number().integer().min(1_000).default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),

  MEDIA_STORAGE_PATH: Joi.string()
    .trim()
    .min(1)
    .custom((value: string, helpers) =>
      /(^|[\\/])public([\\/]|$)/i.test(value)
        ? helpers.error('any.invalid')
        : value,
    )
    .default('data/media'),

  JWT_SECRET: Joi.string().min(20).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),

  REFRESH_JWT_SECRET: Joi.string().min(20).required(),
  REFRESH_JWT_EXPIRES_IN: Joi.string().default('7d'),

  REFRESH_COOKIE_NAME: Joi.string().trim().min(1).default('refresh_token'),
  REFRESH_COOKIE_SECURE: Joi.boolean()
    .default(false)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.valid(true).required(),
    })
    .when('REFRESH_COOKIE_SAMESITE', {
      is: 'none',
      then: Joi.valid(true).required(),
    }),
  REFRESH_COOKIE_SAMESITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .default('lax'),
});
