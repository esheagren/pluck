CREATE TABLE "algorithm_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"algorithm_type" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_system_default" boolean DEFAULT false,
	"initial_ease" numeric DEFAULT 2.5,
	"minimum_ease" numeric DEFAULT 1.3,
	"ease_bonus_easy" numeric DEFAULT 0.15,
	"ease_penalty_again" numeric DEFAULT 0.2,
	"ease_penalty_hard" numeric DEFAULT 0.15,
	"hard_interval_multiplier" numeric DEFAULT 1.2,
	"easy_interval_multiplier" numeric DEFAULT 1.3,
	"learning_steps" numeric[],
	"graduating_interval" numeric DEFAULT 1,
	"easy_graduating_interval" numeric DEFAULT 4,
	"relearning_steps" numeric[],
	"minimum_interval_after_lapse" numeric DEFAULT 1,
	"lapse_ease_penalty" numeric DEFAULT 0.2,
	"lapse_interval_percentage" numeric DEFAULT 0,
	"leech_threshold" integer DEFAULT 8,
	"interval_modifier" numeric DEFAULT 1,
	"max_interval_days" integer DEFAULT 365,
	"fsrs_weights" numeric[],
	"fsrs_desired_retention" numeric DEFAULT 0.9,
	"numeric_wide_interval_threshold" numeric DEFAULT 2,
	"numeric_tight_interval_threshold" numeric DEFAULT 0.3,
	"numeric_miss_rating" text DEFAULT 'again',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "card_review_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"interval_days" numeric DEFAULT 0 NOT NULL,
	"ease_factor" numeric DEFAULT 2.5 NOT NULL,
	"stability" numeric,
	"difficulty" numeric,
	"step_index" integer DEFAULT 0,
	"review_count" integer DEFAULT 0 NOT NULL,
	"lapse_count" integer DEFAULT 0 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"numeric_review_count" integer DEFAULT 0,
	"numeric_hits" integer DEFAULT 0,
	"calibration_score" numeric,
	"avg_interval_width" numeric,
	"is_leech" boolean DEFAULT false,
	"is_buried_today" boolean DEFAULT false,
	"last_reviewed_at" timestamp with time zone,
	"graduated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"image_url" text,
	"user_id" uuid,
	"folder_id" uuid,
	"style" text,
	"answer_type" text DEFAULT 'text',
	"numeric_answer" numeric,
	"numeric_lower" numeric,
	"numeric_upper" numeric,
	"numeric_unit" text,
	"numeric_precision" integer DEFAULT 0,
	"tags" text[],
	"source_selection" text,
	"source_context" text,
	"source_title" text,
	"source_selector" text,
	"source_text_offset" integer
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6B7280',
	"sort_order" integer DEFAULT 0,
	"weight" integer,
	"is_paused" boolean DEFAULT false NOT NULL,
	"new_per_day" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_review_state_id" uuid,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"review_mode" text DEFAULT 'standard' NOT NULL,
	"rating" text NOT NULL,
	"response_time_ms" integer,
	"response_lower" numeric,
	"response_upper" numeric,
	"correct_answer" numeric,
	"contained_answer" boolean,
	"interval_width" numeric,
	"relative_width" numeric,
	"confidence_level_used" numeric,
	"derived_rating" text,
	"previous_status" text,
	"previous_interval" numeric,
	"previous_ease" numeric,
	"previous_due" timestamp with time zone,
	"previous_stability" numeric,
	"previous_difficulty" numeric,
	"new_status" text,
	"new_interval" numeric,
	"new_ease" numeric,
	"new_due" timestamp with time zone,
	"new_stability" numeric,
	"new_difficulty" numeric,
	"algorithm_version" text,
	"algorithm_params" jsonb,
	"scoring_details" jsonb,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"cards_new" integer DEFAULT 0,
	"cards_learning" integer DEFAULT 0,
	"cards_review" integer DEFAULT 0,
	"cards_relearning" integer DEFAULT 0,
	"again_count" integer DEFAULT 0,
	"hard_count" integer DEFAULT 0,
	"good_count" integer DEFAULT 0,
	"easy_count" integer DEFAULT 0,
	"numeric_reviews" integer DEFAULT 0,
	"numeric_hits" integer DEFAULT 0,
	"total_time_ms" integer DEFAULT 0,
	"avg_time_per_card_ms" integer,
	"algorithm_config_id" uuid,
	"algorithm_type" text,
	"platform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_calibration_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"total_numeric_reviews" integer DEFAULT 0,
	"total_hits" integer DEFAULT 0,
	"overall_hit_rate" numeric,
	"stats_by_confidence" jsonb,
	"stats_by_magnitude" jsonb,
	"stats_by_tag" jsonb,
	"calibration_trend" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_calibration_stats_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_study_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rating_system" text DEFAULT '4-button',
	"session_size" integer,
	"target_retention" numeric DEFAULT 0.9,
	"new_cards_per_day" integer DEFAULT 20,
	"max_reviews_per_day" integer,
	"interleave_topics" boolean DEFAULT true,
	"interleave_card_types" boolean DEFAULT true,
	"show_answer_time" boolean DEFAULT false,
	"show_next_review_date" boolean DEFAULT true,
	"algorithm_type" text DEFAULT 'sm2',
	"algorithm_config_id" uuid,
	"confidence_level" numeric DEFAULT 0.95,
	"numeric_scoring_mode" text DEFAULT 'width_adjusted',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_study_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"google_sub" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mochi_api_key" text,
	"mochi_deck_id" text,
	"display_name" text,
	"avatar_url" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"primary_category" text,
	"student_level" text,
	"student_field" text,
	"work_fields" text[],
	"work_field_other" text,
	"work_years_experience" text,
	"research_field" text,
	"research_years_experience" text,
	"additional_interests" text[],
	"additional_interests_other" text,
	"spaced_rep_experience" text,
	"technicality_preference" integer,
	"breadth_preference" integer,
	CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
--> statement-breakpoint
ALTER TABLE "algorithm_configs" ADD CONSTRAINT "algorithm_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_review_state" ADD CONSTRAINT "card_review_state_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_review_state" ADD CONSTRAINT "card_review_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_card_review_state_id_card_review_state_id_fk" FOREIGN KEY ("card_review_state_id") REFERENCES "public"."card_review_state"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_algorithm_config_id_algorithm_configs_id_fk" FOREIGN KEY ("algorithm_config_id") REFERENCES "public"."algorithm_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_calibration_stats" ADD CONSTRAINT "user_calibration_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_study_settings" ADD CONSTRAINT "user_study_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_study_settings" ADD CONSTRAINT "user_study_settings_algorithm_config_id_algorithm_configs_id_fk" FOREIGN KEY ("algorithm_config_id") REFERENCES "public"."algorithm_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crs_card_user_idx" ON "card_review_state" USING btree ("card_id","user_id");--> statement-breakpoint
CREATE INDEX "crs_user_due_idx" ON "card_review_state" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "cards_user_idx" ON "cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cards_folder_idx" ON "cards" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "cards_source_url_idx" ON "cards" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "folders_user_idx" ON "folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_logs_user_time_idx" ON "review_logs" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");