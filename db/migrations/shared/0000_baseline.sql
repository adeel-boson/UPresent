CREATE TYPE "public"."InstitutionType" AS ENUM('SCHOOL', 'COLLEGE');--> statement-breakpoint
CREATE TYPE "public"."OrganizationStatus" AS ENUM('PENDING', 'APPROVED');--> statement-breakpoint
CREATE TYPE "public"."Role" AS ENUM('SUPER_ADMIN', 'ORG_ADMIN', 'HOST');--> statement-breakpoint
CREATE TABLE "Organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"institutionType" "InstitutionType" NOT NULL,
	"status" "OrganizationStatus" DEFAULT 'PENDING' NOT NULL,
	"schemaName" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"approvedAt" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"hashedPassword" text NOT NULL,
	"role" "Role" NOT NULL,
	"emailVerified" timestamp (3),
	"organizationId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "Organization_schemaName_key" ON "Organization" USING btree ("schemaName");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");