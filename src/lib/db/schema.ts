import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { foreignKey, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// The shared schema: tables every Organization shares, living in `public`.
// Tenant tables live in `tenant-schema.ts` instead (see ADR-0009).
//
// Table, column, enum, index and constraint names are the ones the original
// schema used, so the baseline migration builds an identical database.

// See CONTEXT.md for the role definitions. HOST Users are created when an
// org-admin invites a host (src/lib/groups/invite-host.ts).
export const roleEnum = pgEnum("Role", ["SUPER_ADMIN", "ORG_ADMIN", "HOST"]);
export type Role = (typeof roleEnum.enumValues)[number];

// v1 scope is schools and colleges (see CONTEXT.md); more institution types
// will be added as the product extends to universities and event organizers.
export const institutionTypeEnum = pgEnum("InstitutionType", ["SCHOOL", "COLLEGE"]);
export type InstitutionType = (typeof institutionTypeEnum.enumValues)[number];

export const organizationStatusEnum = pgEnum("OrganizationStatus", ["PENDING", "APPROVED"]);
export type OrganizationStatus = (typeof organizationStatusEnum.enumValues)[number];

// Millisecond precision, matching TIMESTAMP(3) in the original schema and
// the precision a JS Date carries.
const timestampColumn = (name: string) => timestamp(name, { precision: 3, mode: "date" });

export const organizations = pgTable(
  "Organization",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    institutionType: institutionTypeEnum("institutionType").notNull(),
    status: organizationStatusEnum("status").notNull().default("PENDING"),
    // The dedicated Postgres schema this Organization's tenant data lives in
    // (see ADR-0001). Assigned at signup, provisioned on approval.
    schemaName: text("schemaName").notNull(),
    createdAt: timestampColumn("createdAt")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    approvedAt: timestampColumn("approvedAt"),
  },
  (table) => [uniqueIndex("Organization_schemaName_key").on(table.schemaName)],
);

// Named so signup can tell a duplicate email apart from any other unique
// violation (see isUniqueViolation).
export const USER_EMAIL_UNIQUE_INDEX = "User_email_key";

export const users = pgTable(
  "User",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    email: text("email").notNull(),
    // Null for an invited host until they accept the invitation; a User
    // without a password can't log in.
    hashedPassword: text("hashedPassword"),
    role: roleEnum("role").notNull(),
    emailVerified: timestampColumn("emailVerified"),
    organizationId: text("organizationId"),
    createdAt: timestampColumn("createdAt")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    // Set by the app on every insert and update, not by a database default,
    // like the original schema's `@updatedAt` column.
    updatedAt: timestampColumn("updatedAt")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex(USER_EMAIL_UNIQUE_INDEX).on(table.email),
    foreignKey({
      name: "User_organizationId_fkey",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    })
      .onDelete("set null")
      .onUpdate("cascade"),
  ],
);

// Links sent to prove a User owns their email (ADR-0004). Only a SHA-256 hash
// of the token is stored, so a leaked table can't be used to verify anyone.
// Rows are deleted when used, and with their User.
export const emailVerificationTokens = pgTable(
  "EmailVerificationToken",
  {
    tokenHash: text("tokenHash").primaryKey(),
    userId: text("userId").notNull(),
    expiresAt: timestampColumn("expiresAt").notNull(),
  },
  (table) => [
    foreignKey({
      name: "EmailVerificationToken_userId_fkey",
      columns: [table.userId],
      foreignColumns: [users.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

// Links sent to set a new password. Kept apart from EmailVerificationToken so a
// verification link can never be used to reset a password. Stored and deleted
// the same way: a SHA-256 hash of the token, removed when used or with its User.
export const passwordResetTokens = pgTable(
  "PasswordResetToken",
  {
    tokenHash: text("tokenHash").primaryKey(),
    userId: text("userId").notNull(),
    expiresAt: timestampColumn("expiresAt").notNull(),
  },
  (table) => [
    foreignKey({
      name: "PasswordResetToken_userId_fkey",
      columns: [table.userId],
      foreignColumns: [users.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

// Links emailed to an invited host to set their first password. Kept apart
// from the other token tables so an invitation link can only ever accept an
// invitation. Stored and deleted the same way: a SHA-256 hash of the token,
// removed when used or with its User.
export const hostInvitationTokens = pgTable(
  "HostInvitationToken",
  {
    tokenHash: text("tokenHash").primaryKey(),
    userId: text("userId").notNull(),
    expiresAt: timestampColumn("expiresAt").notNull(),
  },
  (table) => [
    foreignKey({
      name: "HostInvitationToken_userId_fkey",
      columns: [table.userId],
      foreignColumns: [users.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
}));

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));
