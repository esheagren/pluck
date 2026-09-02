CREATE TABLE "card_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigserial NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_events_seq_unique" UNIQUE("seq")
);
--> statement-breakpoint
DROP INDEX "crs_card_user_idx";--> statement-breakpoint
ALTER TABLE "card_review_state" ADD COLUMN "component_id" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "spec" jsonb;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "provenance" jsonb;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "capture_key" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "snapshot_seq" bigint;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "snapshot_algorithm" text;--> statement-breakpoint
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_events_user_seq_idx" ON "card_events" USING btree ("user_id","seq");--> statement-breakpoint
CREATE INDEX "card_events_card_seq_idx" ON "card_events" USING btree ("card_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "crs_card_user_component_idx" ON "card_review_state" USING btree ("card_id","user_id","component_id");--> statement-breakpoint
CREATE INDEX "cards_user_deleted_idx" ON "cards" USING btree ("user_id","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "cards_user_capture_key_idx" ON "cards" USING btree ("user_id","capture_key") WHERE capture_key is not null;