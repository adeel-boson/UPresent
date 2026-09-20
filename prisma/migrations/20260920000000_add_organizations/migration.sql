-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('SCHOOL', 'COLLEGE');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institutionType" "InstitutionType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING',
    "schemaName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_schemaName_key" ON "Organization"("schemaName");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
