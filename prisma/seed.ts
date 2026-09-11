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

  // O catálogo não depende da conta de administração, e por isso vem antes: o
  // trecho abaixo tem três saídas antecipadas, e todas elas são normais. Quando
  // o catálogo ficava no fim, bastava a conta já existir para ele nunca ser
  // criado, e a tela que o edita abria vazia.
  await seedLeaks();

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
    console.log(
      'ADMIN_BOOTSTRAP_PASSWORD is empty — set it in .env.local to create the first admin.',
    );
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
  console.log(
    `Admin ${email} created. Change the password on first login, then drop ADMIN_BOOTSTRAP_PASSWORD.`,
  );
  console.log(`(seed nonce ${randomBytes(4).toString('hex')})`);
}

/**
 * O vocabulário inicial de leaks.
 *
 * São os mesmos dez que o replayer já oferecia por padrão, agora num catálogo
 * que a administração edita. O `upsert` pelo slug torna o seed repetível: rodar
 * de novo não duplica nem sobrescreve um nome que a administração mudou.
 */
async function seedLeaks() {
  const initial = [
    {
      slug: 'overfold',
      label: 'Overfold',
      color: '#4fa3ff',
      hint: 'Desiste mais do que a mão e o preço pedem.',
    },
    {
      slug: 'underfold',
      label: 'Underfold',
      color: '#38b6ff',
      hint: 'Paga demais em spots que não comportam.',
    },
    {
      slug: 'sizing',
      label: 'Sizing',
      color: '#f5c542',
      hint: 'Tamanho de aposta que não serve ao plano da mão.',
    },
    {
      slug: 'icm',
      label: 'ICM',
      color: '#ef8f4c',
      hint: 'Ignora o que a premiação faz com o valor das fichas.',
    },
    {
      slug: 'bluff-catch',
      label: 'Bluff catch',
      color: '#c2185b',
      hint: 'Paga ou desiste no river sem ler a história da mão.',
    },
    {
      slug: 'thin-value',
      label: 'Thin value',
      color: '#7b3fb5',
      hint: 'Deixa de apostar valor fino, ou aposta onde não há.',
    },
    {
      slug: 'position',
      label: 'Position',
      color: '#12a3a3',
      hint: 'Joga a mão como se a posição não importasse.',
    },
    {
      slug: 'tilt',
      label: 'Tilt',
      color: '#e53935',
      hint: 'A decisão veio da mão anterior, não desta.',
    },
    {
      slug: 'preflop-range',
      label: 'Preflop range',
      color: '#43a047',
      hint: 'Abre ou defende fora do que a posição comporta.',
    },
    {
      slug: 'missed-value',
      label: 'Missed value',
      color: '#aacc00',
      hint: 'Passou a vez onde havia valor a tirar.',
    },
  ];

  for (const [index, leak] of initial.entries()) {
    await prisma.leakCatalogItem.upsert({
      where: { slug: leak.slug },
      create: { ...leak, position: index },
      // Um nome que a administração mudou fica como está.
      update: {},
    });
  }
  console.log(`Leak catalogue: ${initial.length} entries ensured.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
