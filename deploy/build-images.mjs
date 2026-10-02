import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const images = [
  ['api', 'Dockerfile', 'production', '.'],
  ['migration', 'Dockerfile', 'migration', '.'],
  ['frontend', 'frontend/Dockerfile', 'production', '.'],
  ['minio', 'deploy/Dockerfile.minio', 'server', 'deploy'],
  ['mc', 'deploy/Dockerfile.minio', 'client', 'deploy'],
];
for (const [name, file, target, context] of images) {
  const result = spawnSync(
    'docker',
    [
      'build',
      '-f',
      file,
      '--target',
      target,
      '-t',
      `loopkeeper-${name}:l1`,
      context,
    ],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
