-- Ack de publicação: o player confirma versão/revisão aplicada no heartbeat.
ALTER TABLE "device_state"
  ADD COLUMN "applied_publication_version" INTEGER,
  ADD COLUMN "applied_content_revision" TEXT,
  ADD COLUMN "applied_at" TIMESTAMP(3);
