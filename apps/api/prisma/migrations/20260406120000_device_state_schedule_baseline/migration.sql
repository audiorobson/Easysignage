-- AlterTable
ALTER TABLE "device_state" ADD COLUMN "schedule_baseline_item_json" JSONB;
ALTER TABLE "device_state" ADD COLUMN "active_schedule_rule_id" UUID;
