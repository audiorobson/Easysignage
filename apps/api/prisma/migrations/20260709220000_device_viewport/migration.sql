-- Fase L1: viewport lógico (orientação + resolução) por dispositivo
ALTER TABLE "devices"
  ADD COLUMN "viewport_width" INTEGER NOT NULL DEFAULT 1920,
  ADD COLUMN "viewport_height" INTEGER NOT NULL DEFAULT 1080,
  ADD COLUMN "display_orientation" TEXT NOT NULL DEFAULT 'landscape';
