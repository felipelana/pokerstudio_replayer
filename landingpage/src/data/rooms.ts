/**
 * The room catalogue lives in the shared package, where the replayer's importer
 * and the settings screen read the same list. Kept here as a re-export so the
 * landing's own imports stay short.
 *
 * Logos are deliberately absent: redistributing a room's trademark is not ours
 * to do, and a wrong file would be worse than none. The grid sets each name as
 * a wordmark instead, which is accurate and claims nothing. ASSETS.md lists the
 * official brand pages an asset would have to come from.
 */
export { ROOMS, AVAILABLE_ROOMS, COMING_SOON_ROOMS, type Room, type RoomStatus } from '@pokerstudio/shared';
