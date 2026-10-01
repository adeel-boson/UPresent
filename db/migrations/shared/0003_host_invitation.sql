CREATE TABLE "HostInvitationToken" (
	"tokenHash" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "hashedPassword" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "HostInvitationToken" ADD CONSTRAINT "HostInvitationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;