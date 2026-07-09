-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "cover_asset_id" UUID;

-- CreateIndex
CREATE INDEX "sites_tenant_id_created_at_idx" ON "sites"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
