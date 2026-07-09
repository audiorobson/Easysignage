-- CreateTable
CREATE TABLE "publications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "payload_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "publications_device_id_version_key" ON "publications"("device_id", "version");

-- CreateIndex
CREATE INDEX "publications_tenant_id_idx" ON "publications"("tenant_id");

-- CreateIndex
CREATE INDEX "publications_device_id_created_at_idx" ON "publications"("device_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (device_state.current_publication_id existia sem FK)
ALTER TABLE "device_state" ADD CONSTRAINT "device_state_current_publication_id_fkey" FOREIGN KEY ("current_publication_id") REFERENCES "publications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
