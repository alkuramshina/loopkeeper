import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { getTestDatabaseUrl } from './test-environment';

let prisma: PrismaClient | undefined;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: getTestDatabaseUrl() }),
    });
  }

  return prisma;
}

export async function resetTestDatabase(): Promise<void> {
  await getTestPrisma().$executeRawUnsafe(
    'TRUNCATE TABLE "campaign_invitations", "auth_sessions", "campaign_members", "characters", "campaigns", "users" RESTART IDENTITY CASCADE',
  );
}

export async function closeTestDatabase(): Promise<void> {
  await prisma?.$disconnect();
  prisma = undefined;
}

export function applyTestMigrations(): void {
  const prismaCli = require.resolve('prisma/build/index.js');

  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    env: {
      ...process.env,
      DATABASE_URL: getTestDatabaseUrl(),
    },
    stdio: 'inherit',
  });
}
