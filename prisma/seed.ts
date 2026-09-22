import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type SeedAdmin = {
  email: string;
  password: string;
};

function getSeedAdmin(): SeedAdmin {
  if (process.env.SEED_ADMIN !== 'true') {
    throw new Error('Set SEED_ADMIN=true to create a local admin user.');
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required for seeding.');
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
  }

  return { email, password };
}

async function main() {
  const { email, password } = getSeedAdmin();
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required for seeding.');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const existing = await prisma.user.findFirst({
      where: { email },
    });

    if (existing) {
      console.log(`Seed user already exists: ${email}`);
      return;
    }

    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Admin',
        applicationRole: 'ADMIN',
      },
    });

    console.log(`Created seed user ${user.email} with id ${user.userId}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
