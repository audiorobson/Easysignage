-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "sso_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sso_issuer_url" TEXT,
ADD COLUMN "sso_client_id" TEXT,
ADD COLUMN "sso_client_secret" TEXT;
