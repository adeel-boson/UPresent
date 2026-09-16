# Next.js full-stack, deployed to Vercel

UPresent is a solo project built for learning AI-assisted development and resume value, with no funding and no ops budget. We're building it as a single Next.js (App Router) deployable — UI and API in one codebase — rather than a separate React SPA plus a standalone backend service (Fastify/NestJS/Express). Target deployment is Vercel, chosen for its zero-config fit with Next.js and free tier at this project's scale; the app is not deployed yet and stays local (Docker) during initial development.

## Considered options

A separate frontend/backend split was considered for the stronger "real" separation of concerns and broader backend-specific resume signal, but rejected: as a solo developer, the added deploy/ops surface (two services, two deploy pipelines) wasn't worth it against the velocity of a single deployable, especially with AI-assisted tooling that's heavily optimized for Next.js today.
