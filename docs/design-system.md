# UPresent Design System

Foundational tokens and components for UPresent's UI. Established as its own
piece of work ([issue #13](https://github.com/adeel-boson/UPresent/issues/13)),
separate from migrating the existing pages onto it.

Live reference: run `npm run dev` and visit `/style-guide`
([src/app/style-guide/page.tsx](../src/app/style-guide/page.tsx)).

Research backing the decisions below is in
[docs/research/design-system-foundations.md](research/design-system-foundations.md)
— every claim there is cited to a primary source (shadcn/ui docs, WCAG 2.2, NN
Group, Apple HIG, Material Design).

## Scope

This pass establishes the design system itself: tokens, component library,
interaction/accessibility conventions. It does **not** cover:

- Re-skinning the existing pages (login, signup, dashboard, admin/signups)
- Feature-specific UX flows (e.g. the step-by-step attendance-marking flow)
- Per-tenant branding/white-labeling

Those are deliberately separate follow-up work.

## Foundation

- **[shadcn/ui](https://ui.shadcn.com)**, `new-york`-successor `base-nova` style,
  on **Base UI** primitives (`@base-ui/react`) rather than Radix — this is the
  CLI's current upstream default, and the project takes it as-is rather than
  pinning to an older primitive library.
- **Tailwind CSS v4**, CSS-variable-based theming (`@theme inline` in
  [globals.css](../src/app/globals.css) exposes semantic tokens as `bg-primary`,
  `text-foreground`, etc.).
- **Icons:** [lucide-react](https://lucide.dev) — shadcn's default icon set.
- **Fonts:** Geist Sans / Geist Mono via `next/font/google` (self-hosted, no
  runtime request to Google Fonts), wired into `--font-sans` / `--font-mono` in
  `globals.css`.
- Config lives in [components.json](../components.json); add components with
  `npx shadcn@latest add <component>`.

## Color

Base palette is `neutral` — a pure grayscale (zero chroma) scale used for
background, text, borders, and surfaces. One accent color, `blue-600`
(`oklch(0.546 0.245 262.881)`, Tailwind's own value), is layered on top for
`--primary`, `--ring`, and `--sidebar-primary`.

Blue was chosen over green/amber to avoid colliding with the semantic
status colors (present/absent/late) that attendance-tracking screens will
need later — those are reserved, not yet defined, since that's feature-flow
work.

Contrast was checked against WCAG 2.2's 1.4.3 (text) and 1.4.11 (non-text)
Level AA success criteria, computed directly from the OKLCH values (see
`references/design-system-foundations.md` §2 for the citations):

| Pair | Ratio | Requirement | Passes |
|---|---|---|---|
| `primary` bg vs. white text | 5.03:1 | 4.5:1 (normal text) | Yes |
| `primary` vs. light-mode `background` | 5.26:1 | 3:1 (non-text/UI) | Yes |
| `primary` vs. dark-mode `background` | 3.77:1 | 3:1 (non-text/UI) | Yes |

The same `blue-600` value is used in both light and dark mode — it clears
AA in both, so there was no need for a separate dark-mode shade.

## Dark mode

Automatic only, via `prefers-color-scheme` — no manual toggle. This is a
deliberate simplification (see decision log in the issue): a toggle adds a
UI control, persistence, and states to test that aren't justified yet.

Implementation note: shadcn's CLI generates a class-based `.dark` selector
(`@custom-variant dark (&:is(.dark *))`) intended for a manual toggle. That
was removed from `globals.css` so `dark:` utilities and the token
definitions fall back to Tailwind v4's actual default — `@media
(prefers-color-scheme: dark)` — matching the OS-driven decision. If a manual
toggle is ever added, that custom variant is what to reintroduce (paired
with a script that sets the `.dark` class, e.g. via `next-themes`).

## Mobile-first & touch targets

The system is mobile-first: attendance-marking, the highest-frequency
action, is expected to happen on a phone.

shadcn's default interactive sizes (`Button`/`Input`/`Select` default height:
`h-8`, 32px) clear WCAG 2.2's SC 2.5.8 floor (24×24 CSS px) but fall short of
Apple HIG's 44×44pt and Material Design 3's 48×48dp touch-target guidance.
Those defaults were left as-is (not forked) to stay compatible with future
`shadcn add`/upgrade runs. Instead, for primary mobile tap actions — e.g. a
"Mark present" button — use `size="lg"` at minimum and consider an explicit
`h-11`/`h-12` (44–48px) override; this should be settled per-flow when the
attendance-marking UX itself is designed.

## Accessibility target

WCAG 2.2 Level AA. Concretely, from the research doc:

- Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (large text ≥18pt/14pt-bold) — SC 1.4.3
- Non-text/UI-component contrast ≥ 3:1 — SC 1.4.11
- Pointer targets ≥ 24×24 CSS px — SC 2.5.8
- Visible keyboard focus — SC 2.4.7, and not fully obscured — SC 2.4.11

## Components installed

`button`, `input`, `label`, `textarea`, `select`, `card`, `alert`, `badge` —
the set the existing five pages (login, signup, dashboard, admin/signups)
will need once they're migrated. Add more with `npx shadcn@latest add
<name>`; check `/style-guide` after adding to confirm it picks up the theme
correctly.

## Not decided yet (explicitly deferred)

- Semantic status colors (present/absent/late) — feature-flow work
- Per-tenant branding/white-labeling
- Manual dark-mode toggle
- Exact mobile touch-target sizing per component (guidance above, not fixed classes)
