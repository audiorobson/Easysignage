-- CreateTable
CREATE TABLE "playback_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "item_type" TEXT NOT NULL,
    "asset_id" UUID,
    "playlist_id" UUID,
    "event_type" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "meta_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playback_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "playback_logs_tenant_id_device_id_started_at_idx" ON "playback_logs"("tenant_id", "device_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "playback_logs_tenant_id_started_at_idx" ON "playback_logs"("tenant_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "playback_logs_tenant_id_asset_id_idx" ON "playback_logs"("tenant_id", "asset_id");

-- CreateIndex
CREATE INDEX "playback_logs_tenant_id_playlist_id_idx" ON "playback_logs"("tenant_id", "playlist_id");

-- AddForeignKey
ALTER TABLE "playback_logs" ADD CONSTRAINT "playback_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_logs" ADD CONSTRAINT "playback_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_logs" ADD CONSTRAINT "playback_logs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_logs" ADD CONSTRAINT "playback_logs_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
