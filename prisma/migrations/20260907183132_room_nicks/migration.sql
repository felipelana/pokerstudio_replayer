-- CreateTable
CREATE TABLE "RoomNick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "room" VARCHAR(24) NOT NULL,
    "nickname" VARCHAR(60) NOT NULL,

    CONSTRAINT "RoomNick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomNick_nickname_idx" ON "RoomNick"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "RoomNick_userId_room_key" ON "RoomNick"("userId", "room");

-- AddForeignKey
ALTER TABLE "RoomNick" ADD CONSTRAINT "RoomNick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
