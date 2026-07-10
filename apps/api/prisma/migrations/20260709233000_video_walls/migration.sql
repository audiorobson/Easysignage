-- Fase L4: video wall

CREATE TABLE "video_walls" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "grid_rows" INTEGER NOT NULL,
    "grid_cols" INTEGER NOT NULL,
    "virtual_width" INTEGER NOT NULL,
    "virtual_height" INTEGER NOT NULL,
    "display_orientation" TEXT NOT NULL DEFAULT 'landscape',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "playlist_id" UUID,
    "sync_epoch_ms" BIGINT,
    "sync_tolerance_ms" INTEGER NOT NULL DEFAULT 80,
    "revision" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_walls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "video_walls_tenant_id_created_at_idx" ON "video_walls"("tenant_id", "created_at");
CREATE INDEX "video_walls_site_id_idx" ON "video_walls"("site_id");

ALTER TABLE "video_walls" ADD CONSTRAINT "video_walls_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "video_walls" ADD CONSTRAINT "video_walls_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "video_walls" ADD CONSTRAINT "video_walls_playlist_id_fkey"
    FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "video_wall_tiles" (
    "id" UUID NOT NULL,
    "wall_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_wall_tiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "video_wall_tiles_device_id_key" ON "video_wall_tiles"("device_id");
CREATE UNIQUE INDEX "video_wall_tiles_wall_id_row_col_key" ON "video_wall_tiles"("wall_id", "row", "col");
CREATE INDEX "video_wall_tiles_wall_id_idx" ON "video_wall_tiles"("wall_id");

ALTER TABLE "video_wall_tiles" ADD CONSTRAINT "video_wall_tiles_wall_id_fkey"
    FOREIGN KEY ("wall_id") REFERENCES "video_walls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "video_wall_tiles" ADD CONSTRAINT "video_wall_tiles_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
