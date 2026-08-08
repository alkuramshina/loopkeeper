import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number()
    .port()
    .default(3000),

  FRONTEND_URL: Joi.string()
    .uri()
    .required(),

  DATABASE_URL: Joi.string()
    .uri()
    .required(),

  JWT_SECRET: Joi.string()
    .min(20)
    .required(),
  JWT_EXPIRES_IN: Joi.string()
    .default('1h'),

  REFRESH_JWT_SECRET: Joi.string()
    .min(20)
    .required(),
  REFRESH_JWT_EXPIRES_IN: Joi.string()
    .default('7d'),

  REFRESH_COOKIE_NAME: Joi.string()
    .default('refresh_token'),
  REFRESH_COOKIE_SECURE: Joi.boolean(),
  REFRESH_COOKIE_SAMESITE: Joi.string()
    .valid('lax', 'strict', 'none')
    .default('lax')
});