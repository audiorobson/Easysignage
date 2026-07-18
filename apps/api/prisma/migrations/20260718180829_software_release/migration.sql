-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "update_channel" TEXT NOT NULL DEFAULT 'stable';

-- CreateTable
CREATE TABLE "software_releases" (
    "id" UUID NOT NULL,
    "product" TEXT NOT NULL DEFAULT 'electron-player',
    "version" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'stable',
    "checksum" TEXT,
    "download_url" TEXT,
    "notes" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "software_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "software_releases_product_channel_published_at_idx" ON "software_releases"("product", "channel", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "software_releases_product_version_key" ON "software_releases"("product", "version");
