import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkEnvironment } from './validate-environment.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = `loopkeeper-l1-smoke-${randomBytes(6).toString('hex')}`;
const temporary = mkdtempSync(join(tmpdir(), project));
const env = {
  DOMAIN: 'localhost',
  TLS_EMAIL: 'smoke@example.org',
  POSTGRES_USER: 'loopkeeper',
  POSTGRES_DB: 'loopkeeper',
  MINIO_ROOT_USER: 'smoke-root',
  S3_BUCKET: 'smoke-private',
  S3_ACCESS_KEY_ID: 'smoke-runtime',
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
  ...Object.fromEntries(
    ['api', 'frontend', 'migration', 'minio', 'mc'].map((name) => [
      name === 'mc' ? 'MC_IMAGE' : `${name.toUpperCase()}_IMAGE`,
      `loopkeeper-${name}:l1`,
    ]),
  ),
  POSTGRES_IMAGE: 'postgres:17.6-bookworm',
  PROXY_IMAGE: 'caddy:2.10.2-alpine',
};
checkEnvironment({ ...env, DOMAIN: 'smoke.example.org' }, false);
const envPath = join(temporary, 'smoke.env');
writeFileSync(
  envPath,
  Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n'),
  { mode: 0o600 },
);
const base = [
  'compose',
  '-p',
  project,
  '--env-file',
  envPath,
  '-f',
  'deploy/docker-compose.production.yml',
  '-f',
  'deploy/docker-compose.smoke.yml',
];
function docker(args, capture = false) {
  const result = spawnSync('docker', args, {
    cwd: root,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  if (result.status !== 0)
    throw new Error(`Docker operation failed: ${args[0]} ${args[1]}`);
  return result.stdout?.trim();
}
const compose = (...args) => docker([...base, ...args]);
const smoke = (...args) =>
  docker([
    'exec',
    '-e',
    'SMOKE_INTERNAL_TLS=true',
    smokeContainer,
    'node',
    '/checks/smoke.mjs',
    ...args,
  ]);
const smokeContainer = `${project}-checks`;
try {
  compose('config', '--quiet');
  for (const [key, value] of [
    ['JWT_SECRET', ''],
    ['JWT_SECRET', 'example-do-not-print-this-secret-value'],
    ['FRONTEND_URL', 'http://localhost'],
    ['REFRESH_COOKIE_SECURE', 'false'],
    ['S3_REGION', ''],
    ['INVITATION_SECRET', ''],
    ['TRUST_PROXY_HOPS', '2'],
  ]) {
    const failure = spawnSync(
      'docker',
      [...base, 'run', '--rm', '--no-deps', '-e', `${key}=${value}`, 'api'],
      { cwd: root, encoding: 'utf8', timeout: 30_000 },
    );
    const output = (failure.stdout ?? '') + (failure.stderr ?? '');
    if (
      failure.status === 0 ||
      !output.includes('Invalid environment:') ||
      (value.startsWith('example-') && output.includes(value))
    )
      throw new Error(`Unsafe startup validation for ${key}`);
  }
  console.log(
    'Invalid production configurations refused startup without exposing secrets.',
  );
  compose('up', '-d', '--wait', 'postgres', 'minio');
  for (let repeat = 0; repeat < 2; repeat++) {
    compose('run', '--rm', '--no-deps', 'provision');
    compose('run', '--rm', '--no-deps', 'migrate');
    compose('run', '--rm', '--no-deps', 'bootstrap');
  }
  const systemCount = docker(
    [
      ...base,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      env.POSTGRES_USER,
      '-d',
      env.POSTGRES_DB,
      '-tAc',
      'SELECT count(*) FROM game_systems',
    ],
    true,
  );
  if (systemCount !== '1')
    throw new Error('Bootstrap duplicated reference data');
  const badMigration = spawnSync(
    'docker',
    [
      ...base,
      'run',
      '--rm',
      '--no-deps',
      '-e',
      'DATABASE_URL=postgresql://unavailable:unavailable@postgres:5432/not_a_database',
      'migrate',
    ],
    { cwd: root, encoding: 'utf8', timeout: 30_000 },
  );
  if (badMigration.status === 0 || !badMigration.status)
    throw new Error('Migration failure was not propagated');
  console.log('Failed migration blocks the rollout before API startup.');
  compose('up', '-d', '--wait', 'api', 'frontend', 'proxy');
  docker([
    'run',
    '-d',
    '--name',
    smokeContainer,
    '--network',
    `${project}_ingress`,
    env.MIGRATION_IMAGE,
    'node',
    '-e',
    'setInterval(()=>{},1000)',
  ]);
  // Caddy internal certificate is ready asynchronously.
  docker([
    'exec',
    '-e',
    'SMOKE_INTERNAL_TLS=true',
    smokeContainer,
    'node',
    '-e',
    "const https=require('https');let n=0;function poll(){https.get('https://proxy/api/health/ready',{rejectUnauthorized:false,servername:'localhost',headers:{Host:'localhost'}},r=>{r.resume();if(r.statusCode!==200) retry()}).on('error',retry)}function retry(){if(++n>60)process.exit(1);setTimeout(poll,1000)}poll()",
  ]);
  smoke();
  // Actual peer IPs are fixed and different; varying forwarded headers is untrusted.
  const network = JSON.parse(
    docker(['network', 'inspect', `${project}_ingress`], true),
  )[0];
  const prefix = network.IPAM.Config[0].Subnet.split('.').slice(0, 3).join('.');
  for (const suffix of [100, 101])
    docker([
      'run',
      '--rm',
      '--network',
      `${project}_ingress`,
      '--ip',
      `${prefix}.${suffix}`,
      env.MIGRATION_IMAGE,
      'node',
      '/checks/client-ip.mjs',
    ]);
  const anonymous = docker(
    [
      'run',
      '--rm',
      '--network',
      `${project}_backend`,
      '--entrypoint',
      '/bin/sh',
      env.MINIO_IMAGE,
      '-c',
      `curl -s -o /dev/null -w '%{http_code}' http://minio:9000/${env.S3_BUCKET}/unknown-object`,
    ],
    true,
  );
  if (anonymous !== '403') throw new Error('Bucket permits anonymous requests');
  compose('stop', 'api');
  smoke('--api-down');
  compose('up', '-d', '--wait', 'api');
  compose('stop', 'minio');
  smoke('--ready-down');
  compose('up', '-d', '--wait', 'minio');
  compose('stop', 'postgres');
  smoke('--ready-down');
  compose('up', '-d', '--wait', 'postgres');
  // Recreate every persistent service while preserving its volumes.
  compose(
    'up',
    '-d',
    '--wait',
    '--force-recreate',
    'postgres',
    'minio',
    'api',
    'frontend',
    'proxy',
  );
  smoke('--persisted');
  compose('exec', '-T', 'api', 'node', 'dist/media-reconcile.js');
  const rawBindings = docker([...base, 'ps', '--format', 'json'], true);
  const bindings = rawBindings.startsWith('[')
    ? JSON.parse(rawBindings)
    : rawBindings
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
  for (const service of bindings)
    if (
      service.Service !== 'proxy' &&
      service.Publishers?.some((p) => p.PublishedPort)
    )
      throw new Error('An internal service published a host port');
  console.log('Production stack verification passed.');
  if (process.env.SMOKE_KEEP === 'true')
    console.log(
      `Isolated browser stack retained: ${project}; environment file: ${envPath}`,
    );
} finally {
  if (process.env.SMOKE_KEEP !== 'true') {
    spawnSync('docker', ['rm', '-f', smokeContainer], { stdio: 'ignore' });
    // Only this invocation's random project; never development/production volumes.
    compose('down', '--volumes');
    unlinkSync(envPath);
    rmdirSync(temporary);
  }
}
