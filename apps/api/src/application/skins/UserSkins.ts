import { Errors } from '../../domain/errors/index.js';
import { appError, fail, ok, type Result } from '../../shared/result.js';
import type { SkinRepository } from '../../domain/repositories/index.js';
import type { UserSkin } from '../../domain/entities/UserSkin.js';

export interface SkinDeps {
  skins: SkinRepository;
}

/** Rough ceiling so a runaway client cannot fill the row with megabytes. */
const MAX_SKIN_BYTES = 256 * 1024;
const MAX_SKINS_PER_USER = 50;

/**
 * Saves a skin to the user's account (create or overwrite by `skinId`), so the
 * customisation follows them across devices instead of living only in the
 * browser's IndexedDB.
 */
export async function saveUserSkin(
  deps: SkinDeps,
  input: { userId: string; skinId: string; name: string; data: unknown; isDefault?: boolean },
): Promise<Result<UserSkin>> {
  if (!input.skinId.trim() || !input.name.trim()) {
    return fail(appError('invalid_skin', 'The skin needs an id and a name.', 422));
  }
  const size = JSON.stringify(input.data ?? null).length;
  if (size > MAX_SKIN_BYTES) {
    return fail(appError('skin_too_large', 'This skin is too large to store.', 413, { size, max: MAX_SKIN_BYTES }));
  }

  const existing = await deps.skins.listForUser(input.userId);
  const isNew = !existing.some((s) => s.skinId === input.skinId);
  if (isNew && existing.length >= MAX_SKINS_PER_USER) {
    return fail(Errors.quotaExceeded('saved skins'));
  }

  return ok(await deps.skins.save(input));
}

export async function listUserSkins(deps: SkinDeps, userId: string): Promise<Result<UserSkin[]>> {
  return ok(await deps.skins.listForUser(userId));
}

export async function deleteUserSkin(deps: SkinDeps, userId: string, skinId: string): Promise<Result<null>> {
  const existing = await deps.skins.listForUser(userId);
  if (!existing.some((s) => s.skinId === skinId)) return fail(Errors.notFound('Skin'));
  await deps.skins.remove(userId, skinId);
  return ok(null);
}
