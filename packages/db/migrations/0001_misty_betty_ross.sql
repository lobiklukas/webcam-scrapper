CREATE TABLE "frame" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cam_id" integer NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"bytes" integer NOT NULL,
	"content_type" text NOT NULL,
	"etag" text,
	"last_modified" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "frame_cam_sha256_unique" UNIQUE("cam_id","sha256"),
	CONSTRAINT "frame_cam_captured_at_unique" UNIQUE("cam_id","captured_at")
);
--> statement-breakpoint
CREATE TABLE "poll_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cam_id" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"duration_ms" integer,
	"status" text NOT NULL,
	"http_status" integer,
	"bytes" integer,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "cam" ADD COLUMN "poll_interval_s" integer DEFAULT 600 NOT NULL;--> statement-breakpoint
ALTER TABLE "cam" ADD COLUMN "next_poll_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cam" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cam" ADD COLUMN "failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cam" ADD COLUMN "last_sha256" text;--> statement-breakpoint
ALTER TABLE "cam" ADD COLUMN "last_etag" text;--> statement-breakpoint
ALTER TABLE "cam" ADD COLUMN "last_modified" text;--> statement-breakpoint
ALTER TABLE "cam" ADD COLUMN "last_ok_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cam" ADD COLUMN "last_frame_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "frame" ADD CONSTRAINT "frame_cam_id_cam_id_fk" FOREIGN KEY ("cam_id") REFERENCES "public"."cam"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_attempt" ADD CONSTRAINT "poll_attempt_cam_id_cam_id_fk" FOREIGN KEY ("cam_id") REFERENCES "public"."cam"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "frame_cam_captured_at_idx" ON "frame" USING btree ("cam_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "poll_attempt_cam_started_at_idx" ON "poll_attempt" USING btree ("cam_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "poll_attempt_status_started_at_idx" ON "poll_attempt" USING btree ("status","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cam_due_idx" ON "cam" USING btree ("next_poll_at") WHERE enabled and retrieval_url is not null;