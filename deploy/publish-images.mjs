import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
const repository = process.env.GITHUB_REPOSITORY?.toLowerCase();
const commit = process.env.GITHUB_SHA;
if (!repository || !/^[a-f0-9]{40}$/.test(commit ?? ''))
  throw new Error('Trusted CI repository and commit required');
function docker(...args) {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Docker ${args[0]} failed`);
  return result.stdout.trim();
}
const manifest = { COMMIT_SHA: commit };
for (const name of ['api', 'frontend', 'migration', 'minio', 'mc']) {
  const target = `ghcr.io/${repository}-${name}:${commit}`;
  docker('tag', `loopkeeper-${name}:l1`, target);
  docker('push', target);
  const references = JSON.parse(
    docker('image', 'inspect', '--format', '{{json .RepoDigests}}', target),
  );
  const digest = references.find((ref) =>
    ref.startsWith(`ghcr.io/${repository}-${name}@sha256:`),
  );
  if (!digest) throw new Error(`Published digest missing: ${name}`);
  manifest[`${name.toUpperCase()}_IMAGE`] = digest;
}
for (const [key, image] of [
  ['PROXY_IMAGE', 'caddy:2.10.2-alpine'],
  ['POSTGRES_IMAGE', 'postgres:17.6-bookworm'],
]) {
  // Resolve the exact upstream image already exercised by the smoke test.
  manifest[key] = JSON.parse(
    docker('image', 'inspect', '--format', '{{json .RepoDigests}}', image),
  )[0];
}
mkdirSync('deployment', { recursive: true });
writeFileSync(
  'deployment/manifest.env',
  Object.entries(manifest)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n') + '\n',
);
writeFileSync(
  'deployment/manifest.json',
  JSON.stringify(manifest, null, 2) + '\n',
);
for (const name of [
  'docker-compose.production.yml',
  'Caddyfile',
  'production.env.example',
  'README.md',
  'validate-environment.mjs',
])
  copyFileSync(`deploy/${name}`, `deployment/${name}`);
console.log(`Published deployment manifest for ${commit}`);
