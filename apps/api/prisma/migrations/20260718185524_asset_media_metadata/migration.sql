-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "audio_codec" TEXT,
ADD COLUMN     "duration_ms" INTEGER,
ADD COLUMN     "height_px" INTEGER,
ADD COLUMN     "processed_at" TIMESTAMP(3),
ADD COLUMN     "video_codec" TEXT,
ADD COLUMN     "width_px" INTEGER;
