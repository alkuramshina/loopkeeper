import { normalizeKeyPrefix } from '../media/media-storage';
import * as Joi from 'joi';

const productionSecret = Joi.string()
  .min(32)
  .custom((value: string, helpers) =>
    /(?:dev|test|example|change.?me|placeholder|secret-long-enough)/i.test(
      value,
    )
      ? helpers.error('any.invalid')
      : value,
  );

export const validationSchema: Joi.ObjectSchema<Record<string, unknown>> =
  Joi.object({
    NODE_ENV: Joi.string()
      .valid('development', 'test', 'production')
      .default('development'),

    PORT: Joi.number().port().default(3000),

    FRONTEND_URL: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .when('NODE_ENV', {
        is: 'production',
        then: Joi.string()
          .required()
          .custom((value: string, helpers) => {
            const url = new URL(value);
            return url.protocol !== 'https:' ||
              url.origin !== value ||
              url.username ||
              url.password
              ? helpers.error('any.invalid')
              : value;
          }),
        otherwise: Joi.string().default('http://localhost:3000'),
      }),

    // Only one ingress proxy is supported. Boolean trust would trust all hops.
    TRUST_PROXY_HOPS: Joi.number().integer().valid(0, 1).default(0),

    DATABASE_URL: Joi.string().uri().required(),

    THROTTLE_TTL: Joi.number().integer().min(1_000).default(60_000),
    THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
    // Per-route limit for register/login/refresh/change-password. Raising it is
    // only for automated browser tests, so production keeps the strict default.
    AUTH_THROTTLE_LIMIT: Joi.number()
      .integer()
      .min(1)
      .default(5)
      .when('NODE_ENV', { is: 'production', then: Joi.number().max(5) }),

    S3_ENDPOINT: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .custom((value: string, helpers) => {
        const url = new URL(value);
        return url.username ||
          url.password ||
          url.search ||
          url.hash ||
          url.pathname !== '/'
          ? helpers.error('any.invalid')
          : value;
      })
      .required(),
    S3_REGION: Joi.string().trim().min(1).required(),
    S3_BUCKET: Joi.string()
      .pattern(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
      .required(),
    S3_ACCESS_KEY_ID: Joi.string().trim().min(1).required(),
    S3_SECRET_ACCESS_KEY: Joi.string().min(1).required().when('NODE_ENV', {
      is: 'production',
      then: productionSecret,
    }),
    S3_FORCE_PATH_STYLE: Joi.string().valid('true', 'false').required(),
    S3_KEY_PREFIX: Joi.string()
      .allow('')
      .default('')
      .custom((value: string, helpers) => {
        try {
          normalizeKeyPrefix(value);
          return value;
        } catch {
          return helpers.error('any.invalid');
        }
      }),

    JWT_SECRET: Joi.string().min(20).required().when('NODE_ENV', {
      is: 'production',
      then: productionSecret,
    }),
    JWT_EXPIRES_IN: Joi.string().default('1h'),

    REFRESH_JWT_SECRET: Joi.string()
      .min(20)
      .required()
      .when('NODE_ENV', {
        is: 'production',
        then: productionSecret.invalid(Joi.ref('JWT_SECRET')),
      }),
    REFRESH_JWT_EXPIRES_IN: Joi.string().default('7d'),

    // Signs invitation links so the master can copy an active link again.
    INVITATION_SECRET: Joi.string()
      .min(20)
      .required()
      .when('NODE_ENV', {
        is: 'production',
        then: productionSecret.invalid(
          Joi.ref('JWT_SECRET'),
          Joi.ref('REFRESH_JWT_SECRET'),
        ),
      }),

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
      .default('lax')
      .when('NODE_ENV', {
        is: 'production',
        then: Joi.valid(Joi.override, 'lax'),
      }),
  });

export function validateEnvironment(environment: Record<string, unknown>) {
  const result = validationSchema.validate(environment, {
    abortEarly: false,
    allowUnknown: true,
  });
  if (result.error) {
    // Joi's normal messages can include rejected secret values.
    throw new Error(
      `Invalid environment: ${[...new Set(result.error.details.map((detail) => detail.path.join('.')))].join(', ')}`,
    );
  }
  return result.value;
}
