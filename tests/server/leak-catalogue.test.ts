import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createLeak,
  listActiveLeaks,
  listAllLeaks,
  retireLeak,
  updateLeak,
} from '../../src/server/application/admin/LeakCatalogue.js';

/**
 * O catálogo é vocabulário compartilhado, e a regra que o torna útil é que uma
 * entrada nunca desaparece: as mãos já marcadas guardam o identificador, e uma
 * linha apagada deixaria marcas antigas ilegíveis.
 */
const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://pokerstudio:pokerstudio_dev@localhost:5432/pokerstudio_test?schema=public';
const prisma = new PrismaClient({ datasources: { db: { url } } });
const deps = { prisma };

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.leakCatalogItem.deleteMany({});
});

afterAll(async () => {
  await prisma.leakCatalogItem.deleteMany({});
  await prisma.$disconnect();
});

const valid = () => ({
  slug: `leak-${randomUUID().slice(0, 8)}`,
  label: 'Overfold',
  color: '#4fa3ff',
});

describe('o catálogo de leaks', () => {
  it('cria uma entrada e a oferece a todos', async () => {
    const made = await createLeak(deps, { ...valid(), hint: 'Desiste demais.' });
    expect(made.ok).toBe(true);

    const offered = await listActiveLeaks(deps);
    expect(offered).toHaveLength(1);
    expect(offered[0].label).toBe('Overfold');
    expect(offered[0].hint).toBe('Desiste demais.');
  });

  it('recusa um identificador que não é um slug', async () => {
    for (const slug of ['Com Espaço', 'MAIUSCULA', 'com_underscore', '-comeca-com-hifen', '']) {
      const answer = await createLeak(deps, { ...valid(), slug });
      expect(answer.ok, slug).toBe(false);
    }
  });

  it('recusa uma cor que não é hexadecimal de seis dígitos', async () => {
    for (const color of ['azul', '#fff', '#12345', 'rgb(0,0,0)']) {
      const answer = await createLeak(deps, { ...valid(), color });
      expect(answer.ok, color).toBe(false);
    }
  });

  it('não deixa dois leaks com o mesmo identificador', async () => {
    const input = valid();
    expect((await createLeak(deps, input)).ok).toBe(true);
    const second = await createLeak(deps, { ...input, label: 'Outro nome' });
    expect(second.ok).toBe(false);
  });

  it('renomeia sem mexer no identificador, que é o que as mãos guardam', async () => {
    const made = await createLeak(deps, valid());
    if (!made.ok) throw new Error('não criou');
    const slug = made.value.slug;

    const renamed = await updateLeak(deps, made.value.id, {
      label: 'Desiste demais',
      color: '#ffffff',
    });
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      expect(renamed.value.label).toBe('Desiste demais');
      expect(renamed.value.slug).toBe(slug);
    }
  });

  it('aposenta em vez de apagar, e a entrada continua legível', async () => {
    const made = await createLeak(deps, valid());
    if (!made.ok) throw new Error('não criou');

    const retired = await retireLeak(deps, made.value.id);
    expect(retired.ok).toBe(true);

    // Some da lista oferecida.
    expect(await listActiveLeaks(deps)).toHaveLength(0);
    // E continua existindo, para quem precisar ler uma marca antiga.
    const all = await listAllLeaks(deps);
    expect(all).toHaveLength(1);
    expect(all[0].active).toBe(false);
    expect(all[0].slug).toBe(made.value.slug);
  });

  it('respeita a ordem que a administração pediu', async () => {
    await createLeak(deps, { ...valid(), label: 'Terceiro', position: 30 });
    await createLeak(deps, { ...valid(), label: 'Primeiro', position: 10 });
    await createLeak(deps, { ...valid(), label: 'Segundo', position: 20 });

    const offered = await listActiveLeaks(deps);
    expect(offered.map((leak) => leak.label)).toEqual(['Primeiro', 'Segundo', 'Terceiro']);
  });

  it('diz que não achou, em vez de inventar, quando o id não existe', async () => {
    const answer = await updateLeak(deps, randomUUID(), { label: 'x' });
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error.status).toBe(404);
  });
});
