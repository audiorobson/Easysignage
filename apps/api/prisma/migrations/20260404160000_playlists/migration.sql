-- CreateTable
CREATE TABLE "playlists" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "playlists_tenant_id_created_at_idx" ON "playlists"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "playlist_items" (
    "id" UUID NOT NULL,
    "playlist_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "duration_sec" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "playlist_items_playlist_id_position_key" ON "playlist_items"("playlist_id", "position");

-- CreateIndex
CREATE INDEX "playlist_items_playlist_id_idx" ON "playlist_items"("playlist_id");

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
