DROP INDEX "tenant"."Member_groupId_externalId_key";--> statement-breakpoint
CREATE UNIQUE INDEX "Member_groupId_externalId_key" ON "tenant"."Member" USING btree ("groupId",lower("externalId"));