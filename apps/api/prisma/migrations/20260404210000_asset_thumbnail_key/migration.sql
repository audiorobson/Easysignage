-- Miniaturas para pré-visualização na biblioteca CMS
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "thumbnail_key" TEXT;
