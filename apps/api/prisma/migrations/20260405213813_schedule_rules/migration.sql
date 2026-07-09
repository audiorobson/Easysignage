-- CreateTable
CREATE TABLE "schedule_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT,
    "playlist_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "device_id" UUID,
    "group_id" UUID,
    "day_of_week" INTEGER NOT NULL,
    "start_min" INTEGER NOT NULL,
    "end_min" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_rules_tenant_id_enabled_idx" ON "schedule_rules"("tenant_id", "enabled");

-- CreateIndex
CREATE INDEX "schedule_rules_tenant_id_device_id_day_of_week_idx" ON "schedule_rules"("tenant_id", "device_id", "day_of_week");

-- CreateIndex
CREATE INDEX "schedule_rules_tenant_id_group_id_day_of_week_idx" ON "schedule_rules"("tenant_id", "group_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "device_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
