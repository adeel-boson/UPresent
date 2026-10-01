CREATE TYPE "tenant"."SessionCreationMode" AS ENUM('MANUAL', 'RECURRING');--> statement-breakpoint
CREATE TABLE "tenant"."GroupHost" (
	"groupId" text NOT NULL,
	"hostId" text NOT NULL,
	CONSTRAINT "GroupHost_pkey" PRIMARY KEY("groupId","hostId")
);
--> statement-breakpoint
CREATE TABLE "tenant"."Group" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sessionCreationMode" "tenant"."SessionCreationMode" NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant"."GroupHost" ADD CONSTRAINT "GroupHost_groupId_Group_id_fk" FOREIGN KEY ("groupId") REFERENCES "tenant"."Group"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tenant"."GroupHost" ADD CONSTRAINT "GroupHost_hostId_User_id_fk" FOREIGN KEY ("hostId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;