-- CreateTable
CREATE TABLE "LeakCatalogItem" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "label" VARCHAR(60) NOT NULL,
    "color" VARCHAR(9) NOT NULL,
    "hint" VARCHAR(200),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeakCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeakCatalogItem_slug_key" ON "LeakCatalogItem"("slug");

-- CreateIndex
CREATE INDEX "LeakCatalogItem_active_position_idx" ON "LeakCatalogItem"("active", "position");
