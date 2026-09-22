import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient, System } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const talesFromTheLoopTemplateId = '00000000-0000-4000-8000-000000000001';

const talesFromTheLoopSchema = {
  fields: [
    {
      key: 'age',
      label: 'Age',
      type: 'number',
      required: true,
      min: 10,
      max: 19,
    },
    {
      key: 'body',
      label: 'Body',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
    },
    {
      key: 'tech',
      label: 'Tech',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
    },
    {
      key: 'heart',
      label: 'Heart',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
    },
    {
      key: 'mind',
      label: 'Mind',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
    },
    {
      key: 'iconicItem',
      label: 'Iconic item',
      type: 'string',
      required: true,
      maxLength: 100,
    },
    {
      key: 'pride',
      label: 'Pride',
      type: 'string',
      required: true,
      maxLength: 500,
    },
  ],
};

type SeedAdmin = {
  email: string;
  password: string;
};

function getSeedAdmin(): SeedAdmin | undefined {
  if (process.env.SEED_ADMIN !== 'true') {
    return undefined;
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

async function seedReferenceData(prisma: PrismaClient) {
  await prisma.gameSystem.upsert({
    where: { slug: System.TALES_FROM_THE_LOOP },
    create: {
      slug: System.TALES_FROM_THE_LOOP,
      name: 'Tales from the Loop',
      description: 'The first supported game system for Loopkeeper.',
    },
    update: {},
  });

  await prisma.characterTemplate.upsert({
    where: { templateId: talesFromTheLoopTemplateId },
    create: {
      templateId: talesFromTheLoopTemplateId,
      systemSlug: System.TALES_FROM_THE_LOOP,
      name: 'Kid',
      schema: talesFromTheLoopSchema,
    },
    update: {},
  });
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for seeding.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await seedReferenceData(prisma);

    const admin = getSeedAdmin();
    if (!admin) {
      console.log('Seeded game system reference data.');
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { email: admin.email },
    });
    if (existing) {
      console.log(`Seed user already exists: ${admin.email}`);
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: admin.email,
        passwordHash: await argon2.hash(admin.password),
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
