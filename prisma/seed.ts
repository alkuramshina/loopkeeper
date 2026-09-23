import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaClient, System } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const talesFromTheLoopTemplateId = '00000000-0000-4000-8000-000000000001';
const talesFromTheLoopNpcTemplateId = '00000000-0000-4000-8000-000000000002';

const talesFromTheLoopNpcSchema = {
  title: 'Tales from the Loop — NPC',
  sections: [{ key: 'profile', label: 'Profile' }],
  fields: [
    { key: 'role', label: 'Role', section: 'profile', type: 'string', required: true, maxLength: 100 },
    { key: 'motivation', label: 'Motivation', section: 'profile', type: 'string', maxLength: 500 },
    { key: 'firstImpression', label: 'First impression', section: 'profile', type: 'string', maxLength: 500 },
    { key: 'secret', label: 'Secret', section: 'profile', type: 'string', maxLength: 1000 },
    { key: 'relationship', label: 'Relationship', section: 'profile', type: 'string', maxLength: 500 },
  ],
};

const talesFromTheLoopSchema = {
  title: 'Tales from the Loop — Kid',
  sections: [
    { key: 'identity', label: 'Identity' },
    { key: 'attributes', label: 'Attributes' },
    { key: 'skills', label: 'Skills' },
    { key: 'story', label: 'Story and equipment' },
    { key: 'conditions', label: 'Conditions' },
  ],
  fields: [
    {
      key: 'age',
      label: 'Age',
      section: 'identity',
      type: 'number',
      required: true,
      min: 10,
      max: 19,
    },
    {
      key: 'type',
      label: 'Type',
      section: 'identity',
      type: 'select',
      required: true,
      options: [
        'BOOKWORM',
        'COMPUTER_GEEK',
        'JOCK',
        'POPULAR_KID',
        'ROCKER',
        'TROUBLEMAKER',
        'WEIRDO',
      ],
    },
    {
      key: 'body',
      label: 'Body',
      section: 'attributes',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
    },
    {
      key: 'tech',
      label: 'Tech',
      section: 'attributes',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
    },
    {
      key: 'heart',
      label: 'Heart',
      section: 'attributes',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
    },
    {
      key: 'mind',
      label: 'Mind',
      section: 'attributes',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
    },
    {
      key: 'force',
      label: 'Force',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'move',
      label: 'Move',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'sneak',
      label: 'Sneak',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'tinker',
      label: 'Tinker',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'program',
      label: 'Program',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'calculate',
      label: 'Calculate',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'contact',
      label: 'Contact',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'charm',
      label: 'Charm',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'lead',
      label: 'Lead',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'investigate',
      label: 'Investigate',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'comprehend',
      label: 'Comprehend',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'empathize',
      label: 'Empathize',
      section: 'skills',
      type: 'number',
      required: true,
      min: 0,
      max: 5,
    },
    {
      key: 'drive',
      label: 'Drive',
      section: 'story',
      type: 'string',
      required: true,
      maxLength: 500,
    },
    {
      key: 'pride',
      label: 'Pride',
      section: 'story',
      type: 'string',
      required: true,
      maxLength: 500,
    },
    {
      key: 'problem',
      label: 'Problem',
      section: 'story',
      type: 'string',
      required: true,
      maxLength: 500,
    },
    {
      key: 'anchor',
      label: 'Anchor',
      section: 'story',
      type: 'string',
      required: true,
      maxLength: 500,
    },
    {
      key: 'iconicItem',
      label: 'Iconic item',
      section: 'story',
      type: 'string',
      required: true,
      maxLength: 100,
    },
    {
      key: 'relationships',
      label: 'Relationships',
      section: 'story',
      type: 'string',
      maxLength: 2000,
    },
    {
      key: 'favoriteSong',
      label: 'Favourite song',
      section: 'story',
      type: 'string',
      maxLength: 200,
    },
    {
      key: 'inventory',
      label: 'Inventory',
      section: 'story',
      type: 'string',
      maxLength: 2000,
    },
    {
      key: 'luckPoints',
      label: 'Luck points',
      section: 'story',
      type: 'number',
      min: 0,
      max: 6,
    },
    { key: 'upset', label: 'Upset', section: 'conditions', type: 'boolean' },
    { key: 'scared', label: 'Scared', section: 'conditions', type: 'boolean' },
    {
      key: 'exhausted',
      label: 'Exhausted',
      section: 'conditions',
      type: 'boolean',
    },
    {
      key: 'injured',
      label: 'Injured',
      section: 'conditions',
      type: 'boolean',
    },
  ],
};

type SeedAdmin = { email: string; password: string };

function getSeedAdmin(): SeedAdmin | undefined {
  if (process.env.SEED_ADMIN !== 'true') return undefined;

  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
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
      version: 2,
      characterKind: 'PLAYER_CHARACTER',
    },
    update: {
      schema: talesFromTheLoopSchema,
      version: 2,
      characterKind: 'PLAYER_CHARACTER',
      isActive: true,
    },
  });

  await prisma.characterTemplate.upsert({
    where: { templateId: talesFromTheLoopNpcTemplateId },
    create: {
      templateId: talesFromTheLoopNpcTemplateId,
      systemSlug: System.TALES_FROM_THE_LOOP,
      name: 'NPC',
      schema: talesFromTheLoopNpcSchema,
      version: 1,
      characterKind: 'NPC',
    },
    update: {
      schema: talesFromTheLoopNpcSchema,
      characterKind: 'NPC',
      isActive: true,
    },
  });
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error('DATABASE_URL is required for seeding.');

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
