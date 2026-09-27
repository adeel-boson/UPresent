CREATE TYPE "tenant"."ProbeKind" AS ENUM('RED', 'BLUE');--> statement-breakpoint
CREATE TABLE "tenant"."ProbeGroup" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant"."Probe" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "tenant"."ProbeKind" NOT NULL,
	"label" text NOT NULL,
	"groupId" text,
	"ownerId" text
);
--> statement-breakpoint
ALTER TABLE "tenant"."Probe" ADD CONSTRAINT "Probe_groupId_ProbeGroup_id_fk" FOREIGN KEY ("groupId") REFERENCES "tenant"."ProbeGroup"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant"."Probe" ADD CONSTRAINT "Probe_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;