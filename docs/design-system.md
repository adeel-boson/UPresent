# UPresent Design System

Foundational tokens and components for UPresent's UI. Established in
[issue #13](https://github.com/adeel-boson/UPresent/issues/13); the existing
pages (login, signup, dashboard, admin/signups) were migrated onto it in the
same PR.

Live reference: run `npm run dev` and visit `/style-guide`
([src/app/style-guide/page.tsx](../src/app/style-guide/page.tsx)).

Research backing the decisions below is in
[docs/research/design-system-foundations.md](research/design-system-foundations.md)
— every claim there is cited to a primary source (shadcn/ui docs, WCAG 2.2, NN
Group, Apple HIG, Material Design).

## Scope

This pass establishes the design system itself: tokens, component library,
interaction/accessibility conventions. It does **not** cover:

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
background, text, borders, and surfaces. One accent hue, blue, is layered on
top for `--primary`, `--ring`, and `--sidebar-primary`: `blue-600`
(`oklch(0.546 0.245 262.881)`) in light mode and `blue-400`
(`oklch(0.707 0.165 254.624)`) in dark mode, both Tailwind's own values.

Blue was chosen over green/amber to avoid colliding with the semantic
status colors (present/absent/late) that attendance-tracking screens will
need later — those are reserved, not yet defined, since that's feature-flow
work.

Contrast was checked against WCAG 2.2's 1.4.3 (text) and 1.4.11 (non-text)
Level AA success criteria, computed directly from the OKLCH values (see
`docs/research/design-system-foundations.md` §2 for the citations):

| Pair                                              | Ratio  | Requirement         | Passes |
| ------------------------------------------------- | ------ | ------------------- | ------ |
| Light: `primary-foreground` on `primary` (button) | 5.03:1 | 4.5:1 (normal text) | Yes    |
| Light: `primary` text on `background` (link)      | 5.26:1 | 4.5:1 (normal text) | Yes    |
| Dark: `primary-foreground` on `primary` (button)  | 7.51:1 | 4.5:1 (normal text) | Yes    |
| Dark: `primary` text on `background` (link)       | 7.51:1 | 4.5:1 (normal text) | Yes    |
| Dark: `primary` text on `card` (link in a card)   | 6.79:1 | 4.5:1 (normal text) | Yes    |
| Light: `muted-foreground` on `background`         | 4.73:1 | 4.5:1 (normal text) | Yes    |
| Light: `destructive` on `background`              | 4.76:1 | 4.5:1 (normal text) | Yes    |

`primary` is used as link text as well as a fill, so every pair is held to
the 4.5:1 text threshold, not the 3:1 non-text one. `blue-600` is only
3.4:1 on the dark `card`, which is why dark mode switches to `blue-400` with
a dark `primary-foreground`.

Known gap: shadcn's default `--input` border (`neutral-200`) is 1.26:1
against white. Fields here are always paired with a visible `<Label>`
above them, but if a design relies on the border alone to identify a field,
raise `--input` to meet SC 1.4.11's 3:1.

## Type scale and spacing

These are Tailwind v4's default scales, adopted as-is rather than redefined,
so every Tailwind and shadcn class means what its docs say.

- **Type scale** (`text-*`): `text-2xl` page headings, `text-xl` card
  headings on single-card pages, `text-lg` section headings, `text-base` body,
  `text-sm` form controls, helper and secondary text, `text-xs` captions.
  Headings use `font-heading` (Geist Sans) at `font-semibold` or
  `font-medium`. Body text never goes below `text-sm` (14px).
- **Spacing** (`p-*`, `gap-*`, …): the 4px-based `--spacing` scale. Use
  `gap-1.5` between a label and its field, `gap-4` between fields and
  between cards, `gap-6` between page sections, and `px-4` page gutters on
  phones (`sm:px-6` above).
- **Radius**: `--radius` (0.625rem) and the derived `rounded-*` steps in
  `globals.css`.

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
"Mark present" button — use `size="lg"` plus an explicit `h-11` (44px) or
`h-12` (48px). `size="lg"` alone is `h-9` (36px), which is not enough. The
login, signup and approval buttons already use `size="lg" className="h-11"`.

## Component notes

- **Select**: pass `items` (a value → label map) to `<Select>`. Without it,
  the Base UI trigger shows the raw value (`SCHOOL`) instead of its label
  once something is picked.

## Accessibility target

WCAG 2.2 Level AA. Concretely, from the research doc:

- Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (large text ≥18pt/14pt-bold) — SC 1.4.3
- Non-text/UI-component contrast ≥ 3:1 — SC 1.4.11
- Pointer targets ≥ 24×24 CSS px — SC 2.5.8
- Visible keyboard focus — SC 2.4.7, and not fully obscured — SC 2.4.11

## Components installed

`button`, `input`, `label`, `textarea`, `select`, `card`, `alert`, `badge` —
the set the existing four pages (login, signup, dashboard, admin/signups)
use. Add more with `npx shadcn@latest add
<name>`; check `/style-guide` after adding to confirm it picks up the theme
correctly.

## Not decided yet (explicitly deferred)

- Semantic status colors (present/absent/late) — feature-flow work
- Per-tenant branding/white-labeling
- Manual dark-mode toggle
