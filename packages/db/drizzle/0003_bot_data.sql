CREATE TABLE "bot_job" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"requested_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "discord_guild" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"channels" jsonb NOT NULL,
	"roles" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "example" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"liked" boolean NOT NULL,
	"tags" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "example_text_unique" UNIQUE("text")
);
