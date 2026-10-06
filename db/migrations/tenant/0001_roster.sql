CREATE TABLE "tenant"."Member" (
	"id" text PRIMARY KEY NOT NULL,
	"groupId" text NOT NULL,
	"name" text NOT NULL,
	"externalId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant"."Member" ADD CONSTRAINT "Member_groupId_Group_id_fk" FOREIGN KEY ("groupId") REFERENCES "tenant"."Group"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Member_groupId_externalId_key" ON "tenant"."Member" USING btree ("groupId",lower("externalId"));