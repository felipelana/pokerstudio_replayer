import type { PrismaClient } from '@prisma/client';
import { Errors } from '../../domain/errors/index.js';
import { fail, ok, type Result } from '../../shared/result.js';

/**
 * The leaks the administration suggests to everyone.
 *
 * A reader keeps their own tags, invented for their own game, and nothing here
 * takes that away. What this adds is a shared vocabulary: when two coaches mark
 * the same mistake, a catalogue entry means they used the same word, and a
 * report can count it. Without one, "overfold" and "folds too much" are two
 * different leaks as far as any total is concerned.
 *
 * An entry is retired, never deleted. Hand assessments store the slug, and a
 * row that disappears would turn an old reading into a mark nobody can read.
 */

export interface LeakItem {
  id: string;
  slug: string;
  label: string;
  color: string;
  hint: string | null;
  active: boolean;
  position: number;
}

export interface LeakDeps {
  prisma: PrismaClient;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** What every reader is offered, in the order the administration set. */
export async function listActiveLeaks(deps: LeakDeps): Promise<LeakItem[]> {
  return deps.prisma.leakCatalogItem.findMany({
    where: { active: true },
    orderBy: [{ position: 'asc' }, { label: 'asc' }],
    select: {
      id: true,
      slug: true,
      label: true,
      color: true,
      hint: true,
      active: true,
      position: true,
    },
  });
}

/** Everything, retired entries included, for the administration screen. */
export async function listAllLeaks(deps: LeakDeps): Promise<LeakItem[]> {
  return deps.prisma.leakCatalogItem.findMany({
    orderBy: [{ active: 'desc' }, { position: 'asc' }, { label: 'asc' }],
    select: {
      id: true,
      slug: true,
      label: true,
      color: true,
      hint: true,
      active: true,
      position: true,
    },
  });
}

export interface LeakInput {
  slug: string;
  label: string;
  color: string;
  hint?: string | null;
  position?: number;
}

function check(input: LeakInput): string | undefined {
  if (!SLUG.test(input.slug)) {
    return 'O identificador aceita letras minúsculas, números e hífen, como "bluff-catch".';
  }
  if (!input.label.trim()) return 'O nome não pode ficar vazio.';
  if (!HEX.test(input.color))
    return 'A cor precisa ser um hexadecimal de seis dígitos, como "#4fa3ff".';
  return undefined;
}

export async function createLeak(deps: LeakDeps, input: LeakInput): Promise<Result<LeakItem>> {
  const problem = check(input);
  if (problem) return fail(Errors.validation(problem));

  const taken = await deps.prisma.leakCatalogItem.findUnique({ where: { slug: input.slug } });
  if (taken) return fail(Errors.validation('Já existe um leak com esse identificador.'));

  const row = await deps.prisma.leakCatalogItem.create({
    data: {
      slug: input.slug,
      label: input.label.trim(),
      color: input.color,
      hint: input.hint?.trim() || null,
      position: input.position ?? 0,
    },
    select: {
      id: true,
      slug: true,
      label: true,
      color: true,
      hint: true,
      active: true,
      position: true,
    },
  });
  return ok(row);
}

/**
 * Renaming is safe and the slug is not editable, which is the point: the hands
 * already marked keep pointing at the same entry however it is renamed.
 */
export async function updateLeak(
  deps: LeakDeps,
  id: string,
  patch: {
    label?: string;
    color?: string;
    hint?: string | null;
    position?: number;
    active?: boolean;
  },
): Promise<Result<LeakItem>> {
  const row = await deps.prisma.leakCatalogItem.findUnique({ where: { id } });
  if (!row) return fail(Errors.notFound('Leak'));

  if (patch.label !== undefined && !patch.label.trim()) {
    return fail(Errors.validation('O nome não pode ficar vazio.'));
  }
  if (patch.color !== undefined && !HEX.test(patch.color)) {
    return fail(
      Errors.validation('A cor precisa ser um hexadecimal de seis dígitos, como "#4fa3ff".'),
    );
  }

  const updated = await deps.prisma.leakCatalogItem.update({
    where: { id },
    data: {
      label: patch.label?.trim(),
      color: patch.color,
      hint: patch.hint === undefined ? undefined : patch.hint?.trim() || null,
      position: patch.position,
      active: patch.active,
    },
    select: {
      id: true,
      slug: true,
      label: true,
      color: true,
      hint: true,
      active: true,
      position: true,
    },
  });
  return ok(updated);
}

/**
 * Retiring, not deleting.
 *
 * A hand assessment stores the slug. Removing the row would leave marks that
 * nobody can read back, so the entry stops being offered and stays legible.
 */
export async function retireLeak(deps: LeakDeps, id: string): Promise<Result<LeakItem>> {
  const row = await deps.prisma.leakCatalogItem.findUnique({ where: { id } });
  if (!row) return fail(Errors.notFound('Leak'));
  return updateLeak(deps, id, { active: false });
}
