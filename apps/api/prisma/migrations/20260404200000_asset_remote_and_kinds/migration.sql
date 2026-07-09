-- Suporte a URLs remotas e ficheiros sem storage local
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "remote_url" TEXT;

-- Tornar storage_key opcional (assets só-URL)
ALTER TABLE "assets" ALTER COLUMN "storage_key" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "assets_tenant_id_kind_idx" ON "assets"("tenant_id", "kind");
