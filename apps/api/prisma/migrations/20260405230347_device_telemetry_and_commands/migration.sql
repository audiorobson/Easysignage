-- AlterTable
ALTER TABLE "device_state" ADD COLUMN     "telemetry_snapshot_json" JSONB,
ADD COLUMN     "telemetry_updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "device_telemetry_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT,
    "message" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_telemetry_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_commands" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload_json" JSONB NOT NULL,
    "result_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "device_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_telemetry_events_tenant_id_device_id_created_at_idx" ON "device_telemetry_events"("tenant_id", "device_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "device_telemetry_events_tenant_id_created_at_idx" ON "device_telemetry_events"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "device_commands_tenant_id_device_id_status_idx" ON "device_commands"("tenant_id", "device_id", "status");

-- CreateIndex
CREATE INDEX "device_commands_tenant_id_status_created_at_idx" ON "device_commands"("tenant_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "device_telemetry_events" ADD CONSTRAINT "device_telemetry_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_telemetry_events" ADD CONSTRAINT "device_telemetry_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
