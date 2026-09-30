import { createHash, randomBytes } from "node:crypto";
import type { Route } from "next";

// The scheme shared by every emailed single-use link (email verification,
// password reset): a random token in the link, only its hash in the database.

// Tokens are 256 random bits, so a plain SHA-256 (no salt, no slow hash) is
// enough to make the stored value useless to someone who reads the table.
export function hashEmailLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type EmailLinkToken = {
  // Goes in the emailed link, and nowhere else.
  token: string;
  // Goes in the database.
  tokenHash: string;
};

export function createEmailLinkToken(): EmailLinkToken {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashEmailLinkToken(token) };
}

// The link to `path` carrying `token`, on the public origin from APP_URL. The
// origin is taken from configuration, never from the request's Host header,
// which a client could set to send the link (and its token) to a host they
// control.
export function buildEmailLink(path: Route, token: string): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL must be set to build links in emails (see .env.example).");
  }
  const link = new URL(path, appUrl);
  link.searchParams.set("token", token);
  return link.toString();
}
