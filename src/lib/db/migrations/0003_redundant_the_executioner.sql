ALTER TABLE "media" ADD COLUMN "blob_original_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "blob_medium_key" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "blob_thumb_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "blob_edited_key" text;