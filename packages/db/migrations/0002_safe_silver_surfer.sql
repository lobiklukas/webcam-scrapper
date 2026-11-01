ALTER TABLE "cam" DROP CONSTRAINT "cam_original_id_unique";--> statement-breakpoint
ALTER TABLE "location" DROP CONSTRAINT "location_original_id_unique";--> statement-breakpoint
ALTER TABLE "cam" ADD COLUMN "source" text DEFAULT 'digitraffic' NOT NULL;--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "source" text DEFAULT 'digitraffic' NOT NULL;--> statement-breakpoint
ALTER TABLE "cam" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "location" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
CREATE UNIQUE INDEX "cam_source_original_id_idx" ON "cam" USING btree ("source","original_id");--> statement-breakpoint
CREATE UNIQUE INDEX "location_source_original_id_idx" ON "location" USING btree ("source","original_id");
