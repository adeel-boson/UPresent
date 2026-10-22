# TODO: Deferred security items

Status: open. These are known gaps in the current code that were deliberately left for later.

## No rate limiting on login or signup

The credentials login and the signup action accept unlimited attempts. That leaves password
guessing and signup spam unthrottled. [ADR-0007](../adr/0007-gated-self-serve-onboarding-sync-provisioning.md)
already notes there are "no other abuse controls in place yet"; super-admin approval gates
signups, but it doesn't slow login attempts. Every valid signup also sends an email (a
verification link, or a notice to an existing account's owner), so an unthrottled form can be
used to flood someone's inbox. The fix needs a shared store (serverless instances don't share
memory), so it depends on the deployment choices in [vercel-deployment.md](vercel-deployment.md).
