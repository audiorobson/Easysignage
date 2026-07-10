-- Fase L2: templates de layout e layout por dispositivo

CREATE TABLE "layout_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "zones_json" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "layout_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "layout_templates_slug_key" ON "layout_templates"("slug");
CREATE INDEX "layout_templates_tenant_id_sort_order_idx" ON "layout_templates"("tenant_id", "sort_order");

ALTER TABLE "layout_templates" ADD CONSTRAINT "layout_templates_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "device_layouts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "name" TEXT,
    "zones_json" JSONB NOT NULL,
    "revision" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_layouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_layouts_device_id_key" ON "device_layouts"("device_id");
CREATE INDEX "device_layouts_tenant_id_idx" ON "device_layouts"("tenant_id");

ALTER TABLE "device_layouts" ADD CONSTRAINT "device_layouts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "device_layouts" ADD CONSTRAINT "device_layouts_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "device_layouts" ADD CONSTRAINT "device_layouts_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "layout_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
