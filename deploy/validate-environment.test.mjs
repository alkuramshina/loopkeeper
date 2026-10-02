import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { checkEnvironment } from './validate-environment.mjs';
const environment = {
  DOMAIN: 'app.example.org',
  TLS_EMAIL: 'operator@example.org',
  POSTGRES_USER: 'loopkeeper',
  POSTGRES_DB: 'loopkeeper',
  MINIO_ROOT_USER: 'storage-root',
  S3_BUCKET: 'private-bucket',
  S3_ACCESS_KEY_ID: 'storage-runtime',
  ...Object.fromEntries(
    [
      'POSTGRES_PASSWORD',
      'MINIO_ROOT_PASSWORD',
      'S3_SECRET_ACCESS_KEY',
      'JWT_SECRET',
      'REFRESH_JWT_SECRET',
      'INVITATION_SECRET',
    ].map((key) => [key, randomBytes(32).toString('hex')]),
  ),
  COMMIT_SHA: 'a'.repeat(40),
  ...Object.fromEntries(
    ['API', 'FRONTEND', 'MIGRATION', 'MINIO', 'MC', 'PROXY', 'POSTGRES'].map(
      (name) => [
        `${name}_IMAGE`,
        `registry.example.org/${name.toLowerCase()}@sha256:${'a'.repeat(64)}`,
      ],
    ),
  ),
};
test('operator configuration requires immutable images and a checked commit', () => {
  checkEnvironment(environment);
  assert.throws(
    () => checkEnvironment({ ...environment, API_IMAGE: 'app:latest' }),
    /API_IMAGE/,
  );
  assert.throws(
    () => checkEnvironment({ ...environment, COMMIT_SHA: '' }),
    /COMMIT_SHA/,
  );
});
test('root credentials cannot become runtime credentials', () => {
  assert.throws(
    () =>
      checkEnvironment({
        ...environment,
        S3_ACCESS_KEY_ID: environment.MINIO_ROOT_USER,
      }),
    /runtime identity/,
  );
  assert.throws(
    () =>
      checkEnvironment({
        ...environment,
        S3_SECRET_ACCESS_KEY: environment.MINIO_ROOT_PASSWORD,
      }),
    /independent secrets/,
  );
});
test('rejects placeholder credentials and route injection without disclosing values', () => {
  const secret = 'example-secret-that-must-never-appear-in-logs';
  try {
    checkEnvironment({ ...environment, POSTGRES_PASSWORD: secret });
    assert.fail('Unexpected successful validation');
  } catch (error) {
    assert.match(error.message, /POSTGRES_PASSWORD/);
    assert.ok(!error.message.includes(secret));
  }
  assert.throws(
    () => checkEnvironment({ ...environment, DOMAIN: 'app.example.org/api' }),
    /DOMAIN/,
  );
});
