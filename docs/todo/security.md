# TODO: Deferred security items

Status: open. These are known gaps in the current code that were deliberately left for later.

## Signup reveals whether an account exists

**Problem.** Signing up with an email that's already registered returns "That email is already
in use." ([`src/app/(auth)/signup/actions.ts`](<../../src/app/(auth)/signup/actions.ts>)). Anyone can use the
signup form to check whether an email has an account (account enumeration). That contradicts
the rule in [CODING_STANDARDS.md §10](../../CODING_STANDARDS.md) that errors never reveal whether
an account exists. The login form already follows that rule.

**Options.**

1. Once email verification lands ([#3](https://github.com/adeel-boson/UPresent/issues/3)),
   show the same "Check your email to continue" result for every valid submission. If the
   email is already registered, email the owner that someone tried to sign up with it, and
   don't create anything.
2. Rate-limit signup attempts per IP and per email (see below). This slows enumeration but
   doesn't stop it, so it complements option 1 rather than replacing it.

**Decision needed:** confirm option 1 as part of #3.

## No rate limiting on login or signup

The credentials login and the signup action accept unlimited attempts. That leaves password
guessing and signup spam unthrottled. [ADR-0007](../adr/0007-gated-self-serve-onboarding-sync-provisioning.md)
already notes there are "no other abuse controls in place yet"; super-admin approval gates
signups, but it doesn't slow login attempts. The fix needs a shared store (serverless
instances don't share memory), so it depends on the deployment choices in
[vercel-deployment.md](vercel-deployment.md).

## Email ownership isn't verified

Signup creates an org-admin for any email address without proving the person owns it. The
`User.emailVerified` column exists but nothing sets or checks it yet. This is tracked in
[#3](https://github.com/adeel-boson/UPresent/issues/3).
