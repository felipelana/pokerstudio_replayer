import type { PrismaClient } from '@prisma/client';

export interface RoomNick {
  room: string;
  nickname: string;
}

/**
 * The screen names one account plays under, one per room. Optional everywhere,
 * but once given they are what lets any hand history be tied back to its
 * reader — the file names a hero, the account knows whether that is them.
 */
export async function listRoomNicks(prisma: PrismaClient, userId: string): Promise<RoomNick[]> {
  const rows = await prisma.roomNick.findMany({
    where: { userId },
    orderBy: { room: 'asc' },
    select: { room: true, nickname: true },
  });
  return rows;
}

/**
 * Replaces the whole set in one transaction: the form sends what it has, and
 * what it leaves out is gone. A blank nickname is a removal, not an empty name.
 */
export async function saveRoomNicks(prisma: PrismaClient, userId: string, nicks: RoomNick[]): Promise<RoomNick[]> {
  const clean = nicks
    .map((n) => ({ room: n.room.trim(), nickname: n.nickname.trim() }))
    .filter((n) => n.room && n.nickname);

  await prisma.$transaction([
    prisma.roomNick.deleteMany({ where: { userId } }),
    ...(clean.length
      ? [prisma.roomNick.createMany({ data: clean.map((n) => ({ userId, room: n.room, nickname: n.nickname })) })]
      : []),
  ]);
  return listRoomNicks(prisma, userId);
}
