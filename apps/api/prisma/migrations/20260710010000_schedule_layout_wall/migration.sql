-- Agenda: suporte a layout multi-zona e video wall (L5.2)

ALTER TABLE "schedule_rules" ALTER COLUMN "playlist_id" DROP NOT NULL;

ALTER TABLE "schedule_rules" ADD COLUMN "layout_id" UUID;
ALTER TABLE "schedule_rules" ADD COLUMN "video_wall_id" UUID;

ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_layout_id_fkey"
  FOREIGN KEY ("layout_id") REFERENCES "device_layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_video_wall_id_fkey"
  FOREIGN KEY ("video_wall_id") REFERENCES "video_walls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "schedule_rules_layout_id_idx" ON "schedule_rules"("layout_id");
CREATE INDEX "schedule_rules_video_wall_id_idx" ON "schedule_rules"("video_wall_id");
