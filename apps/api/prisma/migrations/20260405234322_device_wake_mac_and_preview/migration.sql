-- AlterTable
ALTER TABLE "device_state" ADD COLUMN     "preview_snapshot_at" TIMESTAMP(3),
ADD COLUMN     "preview_snapshot_key" TEXT;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "wake_mac" TEXT;
