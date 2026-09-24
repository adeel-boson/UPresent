<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Coding standards

Read [`CODING_STANDARDS.md`](CODING_STANDARDS.md) before writing, changing, or reviewing code in `src/` or `prisma/`. It defines the layers, the tenant-data rules, and the definition of done (`npm run check` green).

## Agent skills

### Issue tracker

GitHub Issues via the `gh` CLI, repo [adeel-boson/UPresent](https://github.com/adeel-boson/UPresent). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`CONTEXT.md` + `docs/adr/` at the repo root). See `docs/agents/domain.md`.

### Branch naming

`<type>/issue-<no>-<a-few-word-description>`, where `<type>` is one of `feature`, `fix`, `hotfix`, `Improvement`, `Chore`. Example: `feature/issue-1-project-scaffold-local-dev`.
