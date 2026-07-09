-- CreateTable
CREATE TABLE "device_groups" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_group_members" (
    "group_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_group_members_pkey" PRIMARY KEY ("group_id","device_id")
);

-- CreateIndex
CREATE INDEX "device_groups_tenant_id_created_at_idx" ON "device_groups"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "device_group_members_device_id_idx" ON "device_group_members"("device_id");

-- AddForeignKey
ALTER TABLE "device_groups" ADD CONSTRAINT "device_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_group_members" ADD CONSTRAINT "device_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "device_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_group_members" ADD CONSTRAINT "device_group_members_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
