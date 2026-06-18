CREATE TYPE "public"."kind" AS ENUM('photo', 'video');--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"title_lower" text NOT NULL,
	"kind" "kind" NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"duration_ms" integer,
	"size_bytes" bigint NOT NULL,
	"r2_original_key" text NOT NULL,
	"r2_medium_key" text,
	"r2_thumb_key" text NOT NULL,
	"r2_edited_key" text,
	"short_edge_px" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "media_title_lower_unique" UNIQUE("title_lower")
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_owner_idx" ON "media" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "media_created_idx" ON "media" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "media_deleted_idx" ON "media" USING btree ("deleted_at");