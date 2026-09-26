# Coding Standards

How code in UPresent is written. It is the standards source for humans, for coding agents, and for the `code-review` skill's Standards axis.

**Precedence.** ADRs in [`docs/adr/`](docs/adr/) outrank this file, and this file outranks general best practice. If a change needs to break a rule here, say so in the PR and explain why. If a rule here conflicts with an ADR, flag it (`Contradicts ADR-000N because…`) rather than silently picking one.

**Canonical examples.** When a rule names a file, that file is the pattern to copy. When the code and this file disagree, fix whichever is wrong in the same PR, so both stay a reliable template.

---

## 1. Definition of done

A change is done when all of these hold:

1. `npm run check` is green (typecheck → lint → format check → tests).
2. Every new or changed domain behavior has a test at its module interface (§9).
3. UI changes have been exercised in the running app (`npm run dev`), at phone width as well as desktop.
4. Docs moved with the code: [`CONTEXT.md`](CONTEXT.md) for new domain terms, an ADR for a new architectural decision, [`README.md`](README.md) for setup or script changes, and this file for a new convention.
5. The diff contains only what the issue asked for. Out-of-scope findings become new issues.

Run `npm run format` to fix formatting and `npx eslint --fix` to fix auto-fixable lint errors.

### Enforced by tooling — don't re-check by hand

| Rule                                                                         | Enforced by                                   |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| Formatting, Tailwind class order                                             | Prettier (`.prettierrc.json`)                 |
| LF line endings                                                              | `.gitattributes`                              |
| `strict` + `noUncheckedIndexedAccess`                                        | `tsconfig.json`                               |
| Internal links and redirects point at real routes                            | `typedRoutes` + `npm run typecheck`           |
| `import type` for type-only imports                                          | ESLint `consistent-type-imports`              |
| Import grouping (external → `@/` → relative)                                 | ESLint `import/order`                         |
| No `../` imports; use `@/`                                                   | ESLint `no-restricted-imports`                |
| `src/app` and `src/components` never import `@/lib/prisma` or `PrismaClient` | ESLint `no-restricted-imports`                |
| Prisma never reaches a client bundle                                         | `import "server-only"` in `src/lib/prisma.ts` |
| React hooks rules, Next.js rules, a11y basics                                | `eslint-config-next`                          |

---

## 2. Before writing code

- **Read the domain.** Read [`CONTEXT.md`](CONTEXT.md) and every ADR that touches the area. Use the glossary's terms exactly (§8).
- **Read the framework docs.** This is Next.js 16 with React 19. Before using a Next.js API, read its guide in `node_modules/next/dist/docs/`. APIs such as async `params`, `proxy.ts`, `PageProps`, and caching differ from older versions.
- **Find the nearest example.** Look for the closest existing module, action, page, or test and follow its shape. The canonical files are listed in each section below.

---

## 3. Architecture and layers

### Directory map

```
src/
├── app/                       Routes: pages, layouts, server actions, route handlers
│   ├── layout.tsx             Root layout: <html>, fonts, the page-title template
│   ├── (auth)/layout.tsx      Signed-out shell (login, signup): one centered card
│   ├── (app)/layout.tsx       Signed-in shell (dashboard, admin/…): header + content
│   └── (group)/<route>/       Route groups don't change the URL (/login, not /(auth)/login)
│       ├── page.tsx           Thin: guard → call domain → render
│       ├── actions.ts         Server actions for this route ("use server")
│       └── _components/       Components used only by this route
├── components/
│   ├── ui/                    shadcn/ui, vendored by the CLI — see §7
│   └── <feature>/             App components shared by 2+ routes (forms/, navigation/, …)
├── lib/
│   ├── <domain>/              Domain modules: organizations/, groups/, attendance/, …
│   ├── auth/                  Auth.js config, password hashing, guards
│   └── prisma.ts              The one PrismaClient (server-only)
├── types/                     Ambient type augmentations only (e.g. next-auth.d.ts)
└── proxy.ts                   Request-level redirects (Next 16's replacement for middleware)
```

### Dependency direction

```
app/ (pages, actions, route handlers) ──► lib/<domain>/ ──► lib/prisma.ts
        │                                     │
        └──► components/                      └──► lib/auth/password.ts, other lib/ modules
```

- Arrows point one way. `lib/` never imports from `app/` or `components/`, and `components/` never imports from `app/`.
- **All database access lives in `src/lib/<domain>/`.** Pages and actions call domain functions. They never build queries. This is the seam where authorization and tenant scoping are enforced once, instead of at every call site. Lint enforces it.

### Domain modules (`src/lib/<domain>/`)

- **Name the folder after a `CONTEXT.md` noun, plural**: `organizations/`, `groups/`, `sessions/`, `members/`, `attendance/`.
- **Use one file per use case, named for the action**: `signup.ts`, `approve.ts`, `list-pending.ts`. The file exports the function, its input type, and its error classes. Canonical: [`src/lib/organizations/approve.ts`](src/lib/organizations/approve.ts).
- **Keep modules deep.** Give each a small interface (one function, one input object) with the complexity hidden inside. If a caller has to call three functions in the right order, make that one function.
- **Inject real side effects at a seam.** Pass processes, the network, email, and the clock in through an interface with a production default. Canonical: `SchemaProvisioner` in [`schema-provisioner.ts`](src/lib/organizations/schema-provisioner.ts), injected into `approveOrganization`. Add a seam only when something actually varies across it (production vs. test counts).
- **Keep domain modules free of framework calls.** They take plain inputs and return plain data. `redirect`, `revalidatePath`, `FormData`, and cookies belong in the route layer.
- **Promote shared code deliberately.** Code used by one route lives next to that route. Move it to `src/lib/` or `src/components/<feature>/` when a second caller appears, not before.

---

## 4. Data access and multi-tenancy

Tenant isolation is the highest-stakes property of this codebase ([ADR-0001](docs/adr/0001-multi-tenant-schema-per-tenant-isolation.md)). A data leak between Organizations is the worst possible bug here.

- **Derive tenant scope from the session, never from the request.** The Organization, and therefore its `schemaName`, comes from the authenticated user's record. A client can say _which_ Group or Session it means (an ID). It never says which Organization it belongs to, and the domain module re-checks that the ID belongs to the caller's Organization.
- **Tenant query pattern: not yet decided.** [ADR-0003](docs/adr/0003-prisma-orm-tenant-pattern-deferred.md) deliberately left open how Prisma targets a tenant schema. The first issue that reads or writes tenant tables (Groups, Sessions, Members, AttendanceRecords) must decide it, write the ADR, and put it behind a single helper in `src/lib/`. Until then, no tenant-table queries exist anywhere else.
- **Enforce role scope inside the query.** A `host` sees only their assigned Groups. Pass the acting user into the domain function and filter in the `where` clause, not by post-filtering in a page.
- **Return DTOs, not rows.** Use `select` to return exactly the fields the caller renders. Full `User` rows carry `hashedPassword` and never leave `src/lib/`. Canonical: [`list-pending.ts`](src/lib/organizations/list-pending.ts).
- **Make multi-write operations atomic.** Wrap them in `prisma.$transaction(async (tx) => …)` and do the uniqueness check inside the transaction. Under Postgres' default READ COMMITTED that check can still race, so also map the unique-index violation (`P2002`) to the same domain error. Canonical: [`signup.ts`](src/lib/organizations/signup.ts).
- **Make state transitions conditional.** Update with the expected current state in the `where` (`updateMany({ where: { id, status: "PENDING" } })`) and check the count, so two concurrent requests can't both apply the transition. Canonical: [`approve.ts`](src/lib/organizations/approve.ts).
- **Audit attendance edits in the same transaction.** Every `AttendanceRecord` edit writes its `AttendanceAuditLog` row inside the transaction that makes the edit ([ADR-0008](docs/adr/0008-attendance-edit-window-with-audit-log.md)).
- **Raw SQL.** Use tagged ``prisma.$queryRaw`…${value}` `` so values are parameterized. `$executeRawUnsafe` is only for identifiers we generate ourselves (e.g. `generateSchemaName()`), with a comment stating why interpolation is safe. Canonical: [`schema-provisioner.ts`](src/lib/organizations/schema-provisioner.ts).
- **Avoid N+1 queries.** Load relations with `select`/`include`, or batch with `where: { id: { in: ids } }`. Lists that grow (rosters, attendance history) are paginated.
- **Migrations.** Create them with `npm run db:migrate` and never edit one that has been applied. Tenant schemas are built by replaying the full migration history ([`schema-provisioner.ts`](src/lib/organizations/schema-provisioner.ts)), so every migration must be safe to run inside a tenant schema as well as the shared one.

---

## 5. Server entry points: pages, server actions, route handlers

Every server action is a public HTTP endpoint that can be called without the UI. Rendering a form only for admins protects nothing.

### Guard first

The first line of every page, action, and route handler that needs a user calls a guard from [`src/lib/auth/guards.ts`](src/lib/auth/guards.ts):

```ts
const user = await requireUser(); // any signed-in user
await requireRole("SUPER_ADMIN"); // specific role(s)
```

`proxy.ts` redirects signed-out visitors as a convenience. It is not an authorization layer, so every entry point still guards itself.

### Validate every input with Zod

- `FormData`, bound arguments, `params`, `searchParams`, and headers are untrusted. Parse them with a Zod schema at the top of the entry point, after the guard.
- **Form actions used with `useActionState`:** `schema.safeParse(Object.fromEntries(formData))`, then return a user-facing state on failure. Canonical: [`src/app/(auth)/signup/actions.ts`](<src/app/(auth)/signup/actions.ts>).
- **Actions called with arguments:** `schema.parse(arg)`. Throwing is correct there, because a malformed ID means a bug or an attack. Canonical: [`src/app/(app)/admin/signups/actions.ts`](<src/app/(app)/admin/signups/actions.ts>).
- Define the schema next to the action. Move it into `src/lib/<domain>/` once a second entry point needs it. Derive enum values from Prisma (`z.enum(InstitutionType)`) rather than re-typing them.
- Zod checks shape, not ownership. Ownership is checked in the domain module (§4).

### Action shape

```ts
"use server";

export async function doThing(_prev: DoThingState, formData: FormData): Promise<DoThingState> {
  const user = await requireRole("ORG_ADMIN"); // 1. guard
  const parsed = schema.safeParse(Object.fromEntries(formData)); // 2. validate
  if (!parsed.success) return { error: "…" };
  try {
    await domainFunction(user, parsed.data); // 3. delegate
  } catch (error) {
    if (error instanceof KnownDomainError) return { error: "…" }; // 4. map expected errors
    throw error; //    rethrow the rest
  }
  revalidatePath("/…"); // 5. revalidate, then redirect if needed
  return { error: null };
}
```

- Export the state type (`LoginState`, `SignupState`) from `actions.ts` for the page's `useActionState`.
- Only a known domain error class maps to a friendly message. Unknown errors are rethrown for the error boundary and the logs, never swallowed into a generic string.
- `redirect()` throws, so call `revalidatePath` before it.
- A `"use server"` file exports only async functions and types.

### Route handlers (`route.ts`)

Use a route handler only for non-React clients: Auth.js, webhooks, file downloads such as CSV export. UI mutations use server actions, and UI reads happen in Server Components.

---

## 6. React and Next.js

- **Server Components by default.** Add `"use client"` only for state, effects, event handlers, or browser APIs, and push it to the smallest leaf that needs them.
- **Pass minimal, serializable props to client components.** Pass a DTO with the fields the component renders, not a database row or session object.
- **Fetch data on the server.** Pages call domain functions directly. Avoid `useEffect` fetching and client `fetch` calls to our own routes. Run independent reads in parallel with `Promise.all`.
- **Forms.** Use `<form action={…}>` with `useActionState`, and disable the submit button with `pending`. Native attributes (`required`, `type="email"`, `autoComplete`) are for UX; the server's Zod schema is the authority. Canonical: [`src/app/(auth)/login/_components/login-form.tsx`](<src/app/(auth)/login/_components/login-form.tsx>).
- **Page titles.** Every `page.tsx` exports `metadata` with its own `title` (WCAG 2.4.2); the root layout's template appends "· UPresent". `metadata` only works in Server Components, so a page whose UI needs `"use client"` stays a server `page.tsx` that exports `metadata` and renders a client component from `_components/`. Canonical: [`src/app/(auth)/login/page.tsx`](<src/app/(auth)/login/page.tsx>).
- **Navigation.** Use `next/link` for internal links, `redirect()` on the server, and `useRouter` only when an event handler must navigate. Routes are typed, so an invalid href fails the typecheck.
- **Async request APIs.** `params`, `searchParams`, `cookies()`, and `headers()` are Promises. Await them. Type route props with the generated globals `PageProps<"/route">` and `LayoutProps<"/route">`.
- **Effects are for syncing with external systems only.** Derive values during render instead of mirroring them into state, and reset state with a `key` rather than an effect.
- **No speculative memoization.** Add `useMemo`, `useCallback`, or `memo` only for a measured problem.
- **Loading and error UI.** Add `loading.tsx` or a `<Suspense>` boundary around slow reads, `error.tsx` for recoverable failures, and `notFound()` for missing records.
- **Exports.** Next.js file conventions (`page`, `layout`, `route`, `loading`, `error`, `not-found`) use default exports. Everything else uses named exports.

---

## 7. UI and styling

[`docs/design-system.md`](docs/design-system.md) is the source of truth, and `/style-guide` is its live reference.

- **Build from `@/components/ui`.** Add components with `npx shadcn@latest add <name>`. Those files are vendored CLI output (and Prettier-ignored): customize by wrapping or composing in `src/components/<feature>/`, and edit a vendored file only when the change must apply app-wide. Say so in the PR when you do.
- **Use semantic tokens, not raw colors**: `bg-primary`, `text-muted-foreground`, `border-destructive`, not `bg-blue-600`. Attendance status colors are reserved and not yet defined; define them as tokens when the attendance flow is designed.
- **Merge conditional classes with `cn()`**, never with string concatenation.
- **Page shells come from layouts.** A new page joins the `(auth)` or `(app)` route group and renders only its content; it doesn't render its own `<main>` or page gutters. Use [`FormErrorAlert`](src/components/forms/form-error-alert.tsx) for a form's action error and [`TextLink`](src/components/navigation/text-link.tsx) for inline links, rather than restyling `Alert` or `Link`.
- **Design mobile-first.** Base classes target phones and `sm:`/`md:` add larger layouts. Primary tap targets on phone flows are at least 44px (`size="lg"` plus `h-11` or larger).
- **Accessibility: WCAG 2.2 AA.** Every input has a `<Label htmlFor>`. Errors use `<Alert role="alert">`. Interactive elements are real `<button>`s and links. Focus stays visible. Icons that carry meaning get an `aria-label`.
- **Domain terms in UI copy.** A `host` is shown by their `host title` (e.g. "Teacher"), never as the literal word "host". School-facing copy may say "student" or "class", but code keeps the domain terms (§8).

---

## 8. TypeScript and naming

### Types

- **Derive types from their source instead of redeclaring them.** Use Prisma's generated types and enums (`Role`, `InstitutionType`), `z.infer<typeof schema>`, `Session["user"]`, and `Awaited<ReturnType<…>>`.
- **Use `type` for data shapes and `interface` for seams.** A seam is a contract with multiple adapters, such as `SchemaProvisioner`, and interfaces are also used for module augmentation.
- **Give exported functions in `src/lib/` explicit return types.** The return type is part of the module's interface.
- **Handle `unknown` by narrowing.** Narrow external data with Zod or type guards. `any`, `as` casts, and non-null `!` are for trusted boundaries only, each with a comment explaining why it's safe.
- **Model mutually exclusive states as discriminated unions**, not as several optional fields.
- **Prefer string-literal unions to TS `enum`.** Prisma enums are fine as generated.

### Errors

- An expected domain failure that a caller handles is a typed `Error` subclass that sets `name`, exported from the use-case file (`OrganizationNotFoundError`, `EmailAlreadyInUseError`).
- Throw for failures. Return values are for results, and form actions return state only because `useActionState` needs it.
- Messages name the entity and ID and never contain secrets or passwords.

### Naming

| Kind                       | Convention                             | Example                                           |
| -------------------------- | -------------------------------------- | ------------------------------------------------- |
| Files and folders          | kebab-case                             | `schema-provisioner.ts`, `list-pending.ts`        |
| Components, types, classes | PascalCase                             | `PendingSignupsPage`, `SignupState`               |
| Functions and variables    | camelCase; functions start with a verb | `approveOrganization`, `listPendingOrganizations` |
| Booleans                   | `is`/`has`/`can` prefix                | `isLoggedIn`, `isValidPassword`                   |
| Module constants           | SCREAMING_SNAKE_CASE                   | `SALT_ROUNDS`, `PUBLIC_PATHS`                     |
| Tests                      | `<file>.test.ts` beside the file       | `approve.test.ts`                                 |

- **Domain vocabulary is binding.** Use `Organization` (not tenant, school, account), `Group` (not class, course), `Session` (not meeting), `Member` (not student), `AttendanceRecord` (not check-in), `host` (not teacher), and `org-admin`/`super-admin` (never a bare "admin"). A concept missing from `CONTEXT.md` is added there, via the `domain-modeling` skill, before it is named in code.
- A name states what a thing _is_ or _does_. If no honest name comes, the design is unclear. Fix the design.
- Split a file when it holds two unrelated responsibilities or grows past about 300 lines.

---

## 9. Testing

Stack: Vitest, `node` environment, tests colocated as `src/**/*.test.ts`. For test-first work, use the `tdd` skill.

- **Test domain modules at their interface.** Call the exported function and assert on its result, its thrown errors, and its calls across the seams. Canonical: [`approve.test.ts`](src/lib/organizations/approve.test.ts).
- **Mock only at system boundaries**: `@/lib/prisma`, injected seams (`SchemaProvisioner`), `next/navigation`, and the clock. Never mock our own domain modules from inside their own tests. Use `vi.hoisted` + `vi.mock` as in the existing tests.
- **Name tests as behaviors in domain language**, e.g. `"throws when the organization is already approved"`.
- **Take expected values from the spec or literals.** Never recompute them the way the code does.
- **Fix bugs test-first.** Write the failing test, then the fix.
- **Security logic is always tested.** Guards, role scoping, and tenant scoping are covered, including the denial paths. Canonical: [`guards.test.ts`](src/lib/auth/guards.test.ts).
- Not unit-tested: vendored `components/ui`, and pages that only guard, delegate, and render (verify those in the running app). When a client component gains real logic, add React Testing Library + jsdom in its own issue.

---

## 10. Security baseline

- Secrets live in `process.env` and are read only in server modules under `src/lib/`. A secret never gets a `NEXT_PUBLIC_` prefix. New variables are added to `.env.example` with a comment.
- Modules that touch the database or secrets import `server-only`, directly or through `@/lib/prisma`. Because of that, Node scripts run with `tsx` (e.g. [`prisma/seed.ts`](prisma/seed.ts)) cannot import `@/lib/prisma` or anything that imports it; they create their own `PrismaClient`.
- Emails are stored and looked up lowercased, so sign-up and login match case-insensitively.
- Passwords are handled only through [`src/lib/auth/password.ts`](src/lib/auth/password.ts) (bcrypt). They are never logged, returned, or compared by hand.
- Auth failures show generic messages ("Invalid email or password."), so errors never reveal whether an account exists.
- Nothing logs PII, tokens, or full request bodies.
- Destructive or irreversible operations (approving an Organization, deleting roster data) re-check role and state in the domain module, not just in the UI.

---

## 11. Comments and docs

- **Comments explain why, not what.** Record the constraint, the invariant, or the rejected alternative, and link the ADR when one applies. Canonical: the comments in [`approve.ts`](src/lib/organizations/approve.ts) and [`schema-provisioner.ts`](src/lib/organizations/schema-provisioner.ts).
- **Say why unsafe-looking code is safe** (e.g. why this `$executeRawUnsafe` interpolation is safe).
- **No commented-out code.** Git keeps history.
- **Every `TODO` links an issue**: `// TODO(#12): …`.
- **Record decisions as they are made.** A new architectural decision gets an ADR (`domain-modeling` skill), and new vocabulary goes into `CONTEXT.md`.

---

## 12. Dependencies

- Solve a problem with the platform (Web APIs, React, Next.js) or an existing dependency before adding a new one.
- A new runtime dependency needs a one-line justification in the PR: what it replaces, and why the existing stack can't do it. Prefer small, maintained, typed packages.
- Add shadcn components through the CLI, never by copy-paste.
- Never hand-edit generated files: `package-lock.json`, `next-env.d.ts`, `.next/`, applied migrations.

---

## 13. Git and pull requests

- One issue → one branch → one PR. Branch names follow [`AGENTS.md`](AGENTS.md#branch-naming).
- Each commit is a coherent step whose message says what changed and why, in the imperative ("Add roster CSV import", not "Added…"). Keep formatting-only or rename-only changes in their own commit.
- The PR description links the issue (`Closes #N`), summarizes the behavior change, and lists any deviation from this file or an ADR.
- Never bypass hooks or checks (`--no-verify`). Fix the cause instead.

---

## 14. Working as a coding agent

These rules exist because they make agent output predictable and reviewable.

- **Read before writing** (§2). An agent that skips `CONTEXT.md` invents synonyms. One that skips the bundled Next docs writes Next 13-era code.
- **Copy the canonical example**, then adapt it. If the example itself looks wrong, fix it or flag it rather than copying the flaw.
- **Stay in scope.** Implement what the issue asks. Put adjacent improvements in a new issue, not in the diff.
- **Verify, don't assume.** Run `npm run check` before calling anything done. For UI work, run the app and exercise the flow. If you couldn't verify something, say so in your report.
- **Stop and ask** when a requirement is ambiguous, when a change would contradict an ADR, or when the work needs a decision this file marks as open (e.g. the tenant query pattern in §4).
- **Keep this file true.** When a PR establishes a new convention, update this file in the same PR.
