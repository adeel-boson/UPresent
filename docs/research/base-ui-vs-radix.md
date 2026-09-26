# Base UI vs Radix Primitives: Research Notes

Purpose: decide which primitive library UPresent's shadcn/ui components should use.
The design-system issue asked for "shadcn/ui (Radix primitives + Tailwind)", but the
project was initialised with the `base-nova` style on `@base-ui/react` ^1.8.0
([components.json](../../components.json), [design-system.md](../design-system.md)).
Sections 1–8 are factual and cited. Section 9 is a comparison table and section 10 gives
one recommendation. Research conducted 2026-09-26.

Stack at the time of writing: Next.js 16.3.5, React 19.2.8, `shadcn` CLI ^4.21.0,
`@base-ui/react` 1.8.0 (from `package.json`).

---

## 0. What we actually use from the primitive library

Taken from reading `src/components/ui/*.tsx`:

| Component                   | Primitive import                                          | Primitive-dependent? |
| --------------------------- | --------------------------------------------------------- | -------------------- |
| `button`                    | `@base-ui/react/button`                                   | yes                  |
| `input`                     | `@base-ui/react/input`                                    | yes (thin)           |
| `select`                    | `@base-ui/react/select`                                   | yes (heavy)          |
| `badge`                     | `@base-ui/react/merge-props`, `@base-ui/react/use-render` | yes (thin)           |
| `label`                     | none (plain `<label>`)                                    | no                   |
| `alert`, `card`, `textarea` | none (plain HTML + `cva`)                                 | no                   |

- 4 of 8 components touch Base UI. Only `select` uses a non-trivial primitive (popup,
  positioning, typeahead, hidden form input).
- 6 app files import from `@/components/ui`. Only 2 call sites use a Base UI-only API: the
  `items` prop on `<Select>` in `src/app/signup/page.tsx` and `src/app/style-guide/page.tsx`.
  Nothing in the app uses `render=` or `asChild`.

---

## 1. Release and maintenance status: Base UI

- **v1.0.0 stable shipped 2025-12-11.** The release notes list it as "Stable" with 35
  unstyled components and the new `@base-ui/react` package name.
  Source: [Releases – Base UI](https://base-ui.com/react/overview/releases),
  [npm registry: @base-ui/react](https://registry.npmjs.org/@base-ui/react) (`time["1.0.0"]` = 2025-12-11T15:56Z)
- **There has been a minor release roughly every month since then:** 1.1.0 (2026-01-15),
  1.2.0 (02-12), 1.3.0 (03-12), 1.4.0 (04-13), 1.4.1 (04-20), 1.5.0 (05-19), 1.6.0 (06-18),
  1.7.0 (08-04), 1.8.0 (09-04, latest).
  Source: [npm registry: @base-ui/react](https://registry.npmjs.org/@base-ui/react)
- **The repo is very active.** `mui/base-ui` had 100+ commits on the default branch between
  2026-09-01 and 2026-09-25 (the API page limit was hit). The latest commit was 2026-09-25.
  The repo has about 11.0k stars and 440 open issues plus PRs.
  Source: [GitHub API: mui/base-ui commits](https://api.github.com/repos/mui/base-ui/commits?since=2026-09-01T00:00:00Z),
  [GitHub API: mui/base-ui](https://api.github.com/repos/mui/base-ui)
- **Who builds it:** the About page says it comes "from the creators of Radix, Material UI,
  and Floating UI". The team list includes Colm Tuite, a Radix co-creator. The GitHub org
  is `mui`, so MUI backs it. MUI's funding model is not stated on that page (unverified).
  Source: [About – Base UI](https://base-ui.com/react/overview/about)
- **Adoption:** 13.0M npm downloads in the week of 2026-09-18 to 09-24.
  Source: [npm downloads API: @base-ui/react](https://api.npmjs.org/downloads/point/last-week/@base-ui/react)

## 2. Release and maintenance status: Radix Primitives

- **WorkOS maintains it.** The repo tagline reads "Maintained by @workos", and the README
  contains no deprecation or maintenance-mode notice. The repo has about 19.3k stars and
  356 open issues plus PRs.
  Source: [radix-ui/primitives on GitHub](https://github.com/radix-ui/primitives),
  [GitHub API: radix-ui/primitives](https://api.github.com/repos/radix-ui/primitives)
- **Releases come in bursts with long gaps.** The official releases page lists releases
  on 2025-08-13, then nothing until **2026-06-06**, a gap of about 10 months. After that
  came 2026-06-30, 2026-07-06 and 2026-07-20. On npm, the `radix-ui` package shipped 1.4.3
  (2025-08-13), then 1.5.0 (2026-06-06) through 1.6.7 (2026-07-24): 8 versions in 7 weeks.
  Source: [Releases – Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/releases),
  [npm registry: radix-ui](https://registry.npmjs.org/radix-ui)
- **There have been no commits on the default branch since 2026-07-31** (0 commits from
  2026-08-01 to 2026-09-26). The last push to the repo was 2026-08-08. Between 2025-08-14
  and 2026-06-01 there were 51 commits, most of them merged in a batch at the end of May 2026.
  Source: [GitHub API: radix-ui/primitives commits](https://api.github.com/repos/radix-ui/primitives/commits?since=2026-08-01T00:00:00Z)
- **The mid-2026 releases were substantive.** They include fixes for "infinite re-render
  loops in React 19" (2026-06-30), form-control value updates on reset (2026-07-06), and
  per-primitive subpath entry points plus `/* @__PURE__ */` tree-shaking annotations
  (2026-07-20).
  Source: [Releases – Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/releases)
- **Unified `radix-ui` package:** first released 2025-01-22 as a single entry point for all
  primitives. The latest version is 1.6.7 (2026-07-24). It depends on the individual
  `@radix-ui/react-*` packages, for example `@radix-ui/react-select` 2.3.7.
  Source: [Releases – Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/releases),
  [npm registry: radix-ui](https://registry.npmjs.org/radix-ui)
- **No official WorkOS statement on long-term maintenance was found.** A search of the repo
  issues and discussions turned up no roadmap or status post. Secondary blog posts claim
  that many original maintainers left after the WorkOS acquisition. **Unverified:** that is
  not from a primary source.
  Source (secondary): [Medium – "Is Your Shadcn UI Project at Risk?"](https://mashuktamim.medium.com/is-your-shadcn-ui-project-at-risk-a-deep-dive-into-radixs-future-91af267c4bec)
- **Adoption is still very large:** `@radix-ui/react-select` had 53.7M weekly downloads and
  `radix-ui` had 12.9M (2026-09-18 to 09-24).
  Source: [npm downloads: @radix-ui/react-select](https://api.npmjs.org/downloads/point/last-week/@radix-ui/react-select),
  [npm downloads: radix-ui](https://api.npmjs.org/downloads/point/last-week/radix-ui)

## 3. shadcn/ui's stance

- **Base UI has been the default since July 2026.** The "Base UI as the Default" changelog
  says `npx shadcn init` now picks Base UI and the docs open on the Base UI tabs by default.
  Its reasoning: "Base UI is stable. It's at 1.6.0 with 6M+ weekly downloads" and "The
  community already made the call. We're making it official."
  Source: [July 2026 – Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
- **Radix is still first-class.** The same entry says: "Radix is not being deprecated. We
  still support it, and every update and new component will ship for both libraries (unless
  a component only exists in Base UI)." You opt in with `-b radix`.
  Source: [July 2026 – Base UI as the Default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
- **Other milestones:**
  - December 2025: `npx shadcn create` let users choose "Radix or Base UI" and said "We
    rebuilt every component for Base UI".
  - January 2026: full Base UI docs shipped. "The components look and behave the same way.
    Only the underlying implementation changes."
  - February 2026: blocks became available for both libraries.
    Source: [Dec 2025 – npx shadcn create](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create),
    [Jan 2026 – Base UI Documentation](https://ui.shadcn.com/docs/changelog/2026-01-base-ui),
    [Changelog index](https://ui.shadcn.com/docs/changelog)
- **React Aria was added in July 2026 as a third "first-class component base".** The entry
  also says "Base UI remains the default, and Radix remains fully supported. Existing
  projects stay on their current base."
  Source: [July 2026 – React Aria](https://ui.shadcn.com/docs/changelog/2026-07-react-aria)
- **Style naming:** the `style` value combines a library and a visual style,
  `{library}-{style}` (for example `base-nova` or `radix-nova`). The shadcn `components.json`
  docs say the style "cannot be changed after initialization", which in practice means
  changing it requires re-adding components. The `{library}-{style}` naming comes from a
  secondary source (shadcnblocks). **Partly unverified:** the primary docs page does not
  list the combined names.
  Source: [components.json – shadcn/ui](https://ui.shadcn.com/docs/components-json),
  (secondary) [shadcnblocks – Component Styles](https://www.shadcnblocks.com/blog/shadcn-component-styles-vega-nova-maia-lyra-mira)
- **The February 2026 entry moved `new-york` (Radix) to the unified `radix-ui` package.**
  The migration command is `shadcn migrate radix`.
  Source: [Feb 2026 – Unified Radix UI Package](https://ui.shadcn.com/docs/changelog/2026-02-radix-ui)

## 4. Accessibility claims

- **Base UI:** "Accessibility is our primary focus. Base UI components adhere to WAI-ARIA
  design patterns". The docs say it is tested across platforms, browsers and screen readers.
  Source: [About – Base UI](https://base-ui.com/react/overview/about)
- **Radix:** "follow the WAI-ARIA authoring practices guidelines and are tested in a wide
  selection of modern browsers and commonly used assistive technologies". Its Select follows
  the WAI-ARIA ListBox pattern.
  Source: [Accessibility – Radix](https://www.radix-ui.com/primitives/docs/overview/accessibility),
  [Select – Radix](https://www.radix-ui.com/primitives/docs/components/select)
- The two sets of claims are equivalent. Neither library publishes a third-party audit or
  a VPAT (none found). Both Select components support arrow keys, Enter/Space, Escape and
  typeahead.
  Source: [Select – Base UI](https://base-ui.com/react/components/select), [Select – Radix](https://www.radix-ui.com/primitives/docs/components/select)
- **Open a11y issues relevant to us:**
  - Radix: #3701, "React 19: Select inside Dialog causes aria-hidden focus freeze" (open
    since 2025-10).
  - Base UI: #1761 (keep the focus indicator on the trigger while the popup is open) and
    #1425 ("[field] Does not invalidate certain required controls").
    Source: [radix-ui/primitives#3701](https://github.com/radix-ui/primitives/issues/3701),
    [mui/base-ui#1761](https://github.com/mui/base-ui/issues/1761),
    [mui/base-ui#1425](https://github.com/mui/base-ui/issues/1425)

## 5. Bundle size

Both sides were measured locally with esbuild (bundled, minified, `NODE_ENV=production`,
React external, gzip level 9) against the exact versions listed. These numbers are our own
measurement, not published figures.

| What                                                                                                          | Base UI 1.8.0 (min / gz) | Radix (min / gz)                         |
| ------------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------- |
| Select only                                                                                                   | 125.9 kB / 44.8 kB       | 90.8 kB / 31.4 kB (`react-select` 2.3.7) |
| Our full set (Base: button+input+select+merge-props+use-render; Radix new-york equivalent: slot+label+select) | 137.9 kB / 49.0 kB       | 91.2 kB / 31.6 kB                        |
| Non-Select parts only (Base: button+input+mergeProps+useRender; Radix: slot+label)                            | 27.9 kB / 10.4 kB        | 3.8 kB / 1.7 kB                          |

- Radix is about **17 kB gzipped smaller** for our usage. Most of the difference is in Select,
  because Base UI bundles its own Floating UI fork. Button, Input and Badge cost about 10 kB
  gz on Base UI versus about 2 kB on Radix, since the Radix styles render plain
  `<input>`/`<button>` plus `Slot`.
- Whole-package figures from Bundlephobia are misleading for Base UI, because it is imported
  by subpath. For reference: `@base-ui/react` is 146.9 kB gz whole, `radix-ui` is 71.7 kB gz
  whole, and `@radix-ui/react-select` is 29.4 kB gz.
  Source: [Bundlephobia API: @base-ui/react@1.8.0](https://bundlephobia.com/api/size?package=@base-ui/react@1.8.0),
  [Bundlephobia API: @radix-ui/react-select@2.3.7](https://bundlephobia.com/api/size?package=@radix-ui/react-select@2.3.7),
  [Bundlephobia API: radix-ui@1.6.7](https://bundlephobia.com/api/size?package=radix-ui@1.6.7)
- These components only load on client-component routes. The pages that use Select are
  signup and style-guide.

## 6. React 19 / Next.js 16 support

- **Base UI** peer deps: `react` / `react-dom` `^17 || ^18 || ^19`. The About page states
  support for React 17+ and for Turbopack, which is Next 16's default bundler.
  Source: [npm registry: @base-ui/react](https://registry.npmjs.org/@base-ui/react),
  [About – Base UI](https://base-ui.com/react/overview/about)
- **Radix** peer deps: `^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc`. The 2024-06-19
  release claimed "full React 19 and RSC compatibility". The package ships a `"use client"`
  directive, which we confirmed in `@radix-ui/react-select/dist/index.mjs`.
  Source: [npm registry: @radix-ui/react-select](https://registry.npmjs.org/@radix-ui/react-select),
  [Releases – Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/releases)
- **Radix has several open React 19-specific issues:**
  - [#3701](https://github.com/radix-ui/primitives/issues/3701): Select inside Dialog focus freeze
  - [#3778](https://github.com/radix-ui/primitives/issues/3778): Collapsible replays its
    animation after `<Activity>` hide (React 19.2)
  - [#4093](https://github.com/radix-ui/primitives/issues/4093): Dialog content not
    clickable for the first frame since 1.1.19
  - [#3444](https://github.com/radix-ui/primitives/issues/3444): Checkbox loses its
    FormData value after a `formAction` button

  The last one matters for Server Actions. There were 37 open issues matching "react 19" on
  2026-09-26.
  Source: [GitHub search: radix-ui/primitives "react 19"](https://github.com/radix-ui/primitives/issues?q=is%3Aissue+is%3Aopen+%22react+19%22)

- **Base UI's own Select issues:**
  - [#5358](https://github.com/mui/base-ui/issues/5358): infinite render loop under CPU load
    (open, 2026-07)
  - [#5184](https://github.com/mui/base-ui/issues/5184): popup not removed after close (open)

  There are 11 open Select-labelled issues in total.
  Source: [GitHub search: mui/base-ui select issues](https://github.com/mui/base-ui/issues?q=is%3Aissue+is%3Aopen+label%3A%22component%3A+select%22)

## 7. Form integration (native submission, Server Actions)

- **Base UI Select** takes `name`, `required` and `form` props. It "automatically creates a
  hidden input element for form submission", which `inputRef` exposes.
  Source: [Select – Base UI](https://base-ui.com/react/components/select)
- **Base UI Field/Form:** "Base UI form components use a hidden input to participate in
  native form submission and validation". `<Form errors>` accepts server errors returned
  from `useActionState`, which fits Next Server Actions directly.
  Source: [Forms – Base UI handbook](https://base-ui.com/react/handbook/forms)
- **Radix Select** takes `name`, `required` and `disabled`, and "renders a visually hidden
  native `<select>`" for submission (the internal `BubbleSelect` / `unstable_BubbleInput`).
  Source: [Select – Radix](https://www.radix-ui.com/primitives/docs/components/select)
- **Radix has a known form issue:** [#3875](https://github.com/radix-ui/primitives/issues/3875),
  where the hidden `<select>` makes the document scroll in constrained layouts (open,
  2026-05). The Radix form library `@radix-ui/react-form` is still 0.1.x.
  Source: [radix-ui/primitives#3875](https://github.com/radix-ui/primitives/issues/3875),
  [npm registry: radix-ui deps](https://registry.npmjs.org/radix-ui)
- **Base UI form reset gaps:** [#1346](https://github.com/mui/base-ui/issues/1346) ("Support
  resetting a form to initial values", open) and [#5765](https://github.com/mui/base-ui/issues/5765)
  (`type=reset` leaves `data-filled`). Our signup page already works around reset by
  remounting the form with a `key`.
- **Both libraries read `defaultValue` only on mount.** Uncontrolled components work this
  way in React generally, so switching libraries would not remove the need for the `key`
  remount in `signup/page.tsx`. This is inferred from React semantics and was not tested
  against Radix.

## 8. Known issue in our usage: Base UI Select label display

- Without `items`, `<Select.Value>` renders the **raw value**. With `items` (a record, an
  array of `{label, value}`, or groups), it "renders the matching label for the rendered
  value". You can also pass `children` as a function to `<Select.Value>` for custom
  formatting. This is expected, documented behaviour, not a bug. It is why
  [design-system.md](../design-system.md) says to always pass `items`.
  Source: [Select – Base UI](https://base-ui.com/react/components/select)
- In Radix, `Select.Value` shows the selected item's text automatically, so no `items` map
  is needed.
  Source: [Select – Radix](https://www.radix-ui.com/primitives/docs/components/select)
- Related bug, now fixed: [mui/base-ui#5517](https://github.com/mui/base-ui/issues/5517).
  An `items` record key matching an `Object.prototype` member (for example `"constructor"`)
  resolved to a function instead of the label. It was closed 2026-08. Our keys (`SCHOOL`,
  `teacher`, …) are not affected.
- `placeholder` on `Select.Value` has been supported since v1.1.0. `Select.Label` parts were
  added in v1.3.0. We are on 1.8.0, so both are available.
  Source: [Releases – Base UI](https://base-ui.com/react/overview/releases)

---

## 9. Comparison

| Criterion                    | Base UI (`base-nova`, current)            | Radix (`radix-nova` / `new-york`)                                   |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Stable since                 | v1.0.0, 2025-12-11                        | v1.0 in 2022; mature                                                |
| Release cadence (last 12 mo) | Monthly minors, 1.1 → 1.8                 | ~10-month gap, then 8 releases Jun–Jul 2026, no commits since 07-31 |
| Commit activity (Sep 2026)   | 100+ commits                              | 0 commits                                                           |
| Maintainer                   | MUI team incl. Radix/Floating UI creators | WorkOS; no public roadmap found                                     |
| shadcn status                | **Default** since Jul 2026                | "Fully supported", not deprecated                                   |
| A11y claims                  | WAI-ARIA patterns, AT-tested              | WAI-ARIA APG, AT-tested                                             |
| Bundle for our 4 components  | ~49.0 kB gz                               | ~31.6 kB gz (measured)                                              |
| React 19 / Next 16           | Peer ^19; Turbopack supported             | Peer ^19; 37 open "react 19" issues                                 |
| Select form submission       | Hidden input; `name`/`required`/`form`    | Hidden native `<select>`; `name`/`required`                         |
| Form/Server Action helpers   | `Field`, `Form errors` + `useActionState` | `@radix-ui/react-form` 0.1.x                                        |
| Select label display         | Needs `items` (or `Value` children fn)    | Automatic                                                           |
| Switching cost from today    | 0                                         | ~4–6 h (see below)                                                  |

**Effort to switch (estimate, for reference only):**

1. Change `style` to `radix-nova` and run `shadcn add --overwrite` for the 4
   primitive-backed components plus `label`: about 1 h. This includes re-applying local
   tweaks such as the `cn` import path.
2. Remove `items` in 2 call sites and check `defaultValue={… || null}` semantics (Radix
   uses `undefined`/`""`): about 0.5 h.
3. Manually re-test the signup Server Action (required Select, FormData value, error
   round-trip with `key` remount), the style guide, keyboard and screen-reader behaviour,
   and dark mode: 2–3 h.
4. Update `design-system.md` and `npm run check`: about 0.5 h.

This estimate has not been validated by a spike.

## 10. Recommendation

**Keep Base UI (`base-nova`), and update the issue and docs so they say "shadcn/ui (Base UI
primitives + Tailwind)".**

Rationale:

- It is shadcn's current default. Radix remains supported but is now the opt-in path. New
  components and docs lead with Base UI, so staying on the default keeps `shadcn add` and
  upgrades the least-friction route.
- Its maintenance signal is clearly stronger. Base UI ships monthly and is committed to
  daily. Radix went ~10 months without a release, had a burst in mid-2026, and has had no
  commits for about 8 weeks, with no public roadmap from WorkOS.
- Base UI's `Field`/`Form` + `useActionState` story matches our Next 16 Server Actions
  pattern better. Radix's form package is still 0.1.x, and there are open React 19 form
  and focus bugs.
- The main costs of staying are about 17 kB gz more on the client-only form routes, and the
  `items` prop requirement, which is already documented in `design-system.md`. Neither is
  worth a migration.
- The issue text "Radix primitives" most likely reflects shadcn's pre-July-2026 default,
  not a hard requirement. **Unverified:** confirm with the issue author.

Revisit this decision if Base UI's Select bugs (#5358, #5184) bite in practice, or if
WorkOS publishes a committed Radix roadmap.
