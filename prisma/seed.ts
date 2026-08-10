import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import argon2 from 'argon2';

const prisma = new PrismaClient({} as never);

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@loopkeeper.dev';
  const password = process.env.ADMIN_PASSWORD ?? 'admin';

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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
