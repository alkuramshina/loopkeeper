import { readFileSync } from 'node:fs';

// Parse the restricted KEY=value format used by our operator template.
// No shell expansion, no output of values and no resolved Compose dump.
export function readEnvironment(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const match = /^([A-Z][A-Z0-9_]*)=([^\r\n]*)$/.exec(line);
        if (!match) throw new Error('Invalid environment file format');
        return [match[1], match[2]];
      }),
  );
}

export function checkEnvironment(env, requireDigests = true) {
  const errors = [];
  const required = [
    'DOMAIN',
    'TLS_EMAIL',
    'POSTGRES_USER',
    'POSTGRES_DB',
    'MINIO_ROOT_USER',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
  ];
  for (const key of required) if (!env[key]) errors.push(key);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.TLS_EMAIL ?? ''))
    errors.push('TLS_EMAIL');
  if (!/^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(env.DOMAIN ?? ''))
    errors.push('DOMAIN');
  for (const key of [
    'POSTGRES_USER',
    'POSTGRES_DB',
    'MINIO_ROOT_USER',
    'S3_ACCESS_KEY_ID',
  ])
    if (!/^[a-zA-Z0-9_-]+$/.test(env[key] ?? '')) errors.push(key);
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(env.S3_BUCKET ?? ''))
    errors.push('S3_BUCKET');
  const secrets = [
    'POSTGRES_PASSWORD',
    'MINIO_ROOT_PASSWORD',
    'S3_SECRET_ACCESS_KEY',
    'JWT_SECRET',
    'REFRESH_JWT_SECRET',
    'INVITATION_SECRET',
  ];
  for (const key of secrets) {
    if (
      !/^[a-zA-Z0-9_-]{32,}$/.test(env[key] ?? '') ||
      /dev|test|example|change.?me|placeholder/i.test(env[key] ?? '')
    )
      errors.push(key);
  }
  if (new Set(secrets.map((key) => env[key])).size !== secrets.length)
    errors.push('independent secrets');
  if (env.MINIO_ROOT_USER === env.S3_ACCESS_KEY_ID)
    errors.push('runtime identity');
  for (const key of [
    'API_IMAGE',
    'FRONTEND_IMAGE',
    'MIGRATION_IMAGE',
    'MINIO_IMAGE',
    'MC_IMAGE',
    'PROXY_IMAGE',
    'POSTGRES_IMAGE',
  ]) {
    if (
      !env[key] ||
      (requireDigests && !/@sha256:[a-f0-9]{64}$/.test(env[key]))
    )
      errors.push(key);
  }
  if (requireDigests && !/^[a-f0-9]{40}$/.test(env.COMMIT_SHA ?? ''))
    errors.push('COMMIT_SHA');
  if (errors.length)
    throw new Error(
      `Invalid deployment environment: ${[...new Set(errors)].join(', ')}`,
    );
}

if (process.argv[1]?.endsWith('validate-environment.mjs')) {
  try {
    checkEnvironment({
      ...readEnvironment(process.argv[2]),
      ...readEnvironment(process.argv[3]),
    });
    console.log('Deployment configuration is valid.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
