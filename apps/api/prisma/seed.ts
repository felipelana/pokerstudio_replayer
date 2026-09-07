import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

/**
 * Idempotent seed.
 *
 * The bootstrap admin password is never written in the repository: it is read
 * from ADMIN_BOOTSTRAP_PASSWORD in .env.local and stored only as an Argon2id
 * hash. Remove the variable after the first login.
 */
const prisma = new PrismaClient();

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const referralCode = () =>
  Array.from({ length: 8 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

async function main() {
  await prisma.emailSettings.upsert({
    where: { id: 1 },
    create: { id: 1, provider: 'NONE', requireVerification: false },
    update: {},
  });

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email) {
    console.log('No ADMIN_BOOTSTRAP_EMAIL set — skipping the admin account.');
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
      console.log(`Promoted ${email} to ADMIN.`);
    } else {
      console.log(`Admin ${email} already exists.`);
    }
    return;
  }

  if (!password) {
    console.log('ADMIN_BOOTSTRAP_PASSWORD is empty — set it in .env.local to create the first admin.');
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name: 'Administrator',
      passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      countryCode: 'BR',
      language: 'pt-BR',
      status: 'ACTIVE',
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      referralCode: referralCode(),
      termsAcceptedAt: new Date(),
    },
  });
  console.log(`Admin ${email} created. Change the password on first login, then drop ADMIN_BOOTSTRAP_PASSWORD.`);
  console.log(`(seed nonce ${randomBytes(4).toString('hex')})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
