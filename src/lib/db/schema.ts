import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import { foreignKey, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// The shared schema: tables every Organization shares, living in `public`.
// Tenant tables live in `tenant-schema.ts` instead (see ADR-0009).
//
// Table, column, enum, index and constraint names are the ones the original
// schema used, so the baseline migration builds an identical database.

// HOST is declared here because the login/session model needs to know the
// full set of roles it will eventually carry, but nothing yet issues that
// role — see CONTEXT.md for the role definitions.
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

export const users = pgTable(
  "User",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    email: text("email").notNull(),
    hashedPassword: text("hashedPassword").notNull(),
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
    uniqueIndex("User_email_key").on(table.email),
    foreignKey({
      name: "User_organizationId_fkey",
      columns: [table.organizationId],
      foreignColumns: [organizations.id],
    })
      .onDelete("set null")
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
