# Design System Foundations — Research Notes

Purpose: primary-source findings to ground design-system decisions for UPresent (color
contrast math, spacing/touch-target sizes, form patterns, component library setup). This
document is strictly factual — no recommendations or opinions. Every claim is cited to the
primary source it was read from. Research conducted 2026-09-20.

---

## 1. shadcn/ui setup conventions for Next.js App Router (current, 2026)

### Tailwind CSS version

- New shadcn/ui projects are initialized with **Tailwind CSS v4** by default. The Tailwind v4
  guide states existing Tailwind v3 / React 18 apps "will still work" — v4 is the default for
  new installs, not a hard requirement for existing ones.
  Source: [Tailwind v4 — shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4)
- The February 2025 changelog confirms the scope of the v4 update: "All components are updated
  for Tailwind v4 and React 19," `forwardRef` patterns were removed in favor of
  `React.ComponentProps<...>`, a `data-slot` attribute was added to primitives, and there is
  "Full support for the new `@theme` directive and `@theme inline` option." It also states "HSL
  colors are now converted to OKLCH."
  Source: [February 2025 — Tailwind v4 — shadcn/ui](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4)
- Migrating an existing v3 project is optional and documented via the
  `@tailwindcss/upgrade@next` codemod ("Use the `@tailwindcss/upgrade@next` codemod to remove
  deprecated utility classes and update tailwind config").
  Source: [Tailwind v4 — shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4)
- The Next.js install guide (`docs/installation/next`) itself documents the `shadcn` CLI
  commands rather than restating the Tailwind version; e.g. for existing projects:
  `pnpm dlx shadcn@latest init --preset [CODE] --template next`, and adding components via
  `pnpm dlx shadcn@latest add card` (also documented for npm/yarn/bun). It notes a prerequisite:
  the project's `tsconfig.json` must include the `@/*` import alias, and Tailwind CSS must
  already be installed before running `init` on an existing project.
  Source: [Next.js — shadcn/ui](https://ui.shadcn.com/docs/installation/next)

### Theming: CSS-variable-based approach

- shadcn/ui states explicitly: "We use and recommend CSS variables for theming."
  Source: [Theming — shadcn/ui](https://ui.shadcn.com/docs/theming) and
  [components.json — shadcn/ui](https://ui.shadcn.com/docs/components-json)
- Colors are defined as CSS custom properties at `:root` (light mode) and under a `.dark`
  selector (dark mode), e.g.:
  ```css
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  ```
  The current color format used in the documented examples is **OKLCH**, not the older
  `hsl(var(--background))` pattern (the Tailwind v4 changelog explicitly describes migrating
  existing HSL values to OKLCH — see above).
  Source: [Theming — shadcn/ui](https://ui.shadcn.com/docs/theming)
- Variables are exposed to Tailwind utilities via an `@theme inline` block, e.g.:
  ```css
  @theme inline {
    --color-background: var(--background);
    --color-foreground: var(--foreground);
  }
  ```
  This mapping is what produces utility classes such as `bg-background`, `text-foreground`,
  `border-border`, and `ring-ring`.
  Source: [Theming — shadcn/ui](https://ui.shadcn.com/docs/theming)
- Documented semantic token set: `background`/`foreground`; `card`/`card-foreground`;
  `popover`/`popover-foreground`; `primary`/`primary-foreground`;
  `secondary`/`secondary-foreground`; `muted`/`muted-foreground`; `accent`/`accent-foreground`;
  `destructive`; `border`, `input`, `ring`; `radius`; chart tokens `chart-1` through `chart-5`;
  and sidebar tokens `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-accent`,
  `sidebar-border`, `sidebar-ring`. Dark mode is implemented by redefining the same variable
  names under `.dark`.
  Source: [Theming — shadcn/ui](https://ui.shadcn.com/docs/theming)

### components.json fields

Per the reference page:

- **`$schema`** — points to `https://ui.shadcn.com/schema.json`.
- **`style`** — "The style for your components. **This cannot be changed after initialization.**"
  Only `new-york` is documented as current/valid (see style-deprecation note below).
- **`tailwind.config`** — "Path to where your `tailwind.config.js` file is located. **For
  Tailwind CSS v4, leave this blank.**"
- **`tailwind.css`** — "Path to the CSS file that imports Tailwind CSS into your project."
- **`tailwind.baseColor`** — "This is used to generate the default theme tokens for your
  components. **This cannot be changed after initialization.**" Documented options as of this
  research date: `neutral`, `stone`, `zinc`, `mauve`, `olive`, `mist`, `taupe`. (Note: the June
  2023 CLI changelog documents an earlier/smaller option set of `gray`, `neutral`, `slate`,
  `stone`, `zinc` — the palette option list has since been expanded; see "Base color options"
  below.)
- **`tailwind.cssVariables`** — "We use and recommend CSS variables for theming." `true`
  generates semantic tokens (background, primary, etc.); `false` uses inline Tailwind utility
  values instead.
- **`tailwind.prefix`** — "The prefix to use for your Tailwind CSS utility classes. Components
  will be added with this prefix."
- **`rsc`** — "Whether or not to enable support for React Server Components." When enabled the
  CLI adds `use client` directives to client components.
- **`tsx`** — choose TypeScript vs JavaScript components; `false` generates `.jsx` files.
- **`aliases`** (`components`, `ui`, `lib`, `hooks`, `utils`) — "The CLI uses these values to
  place generated components in the correct location and rewrite imports."
- **`registries`** — configuration for multiple component registries/sources, including
  authentication headers and environment-variable expansion.

Source: [components.json — shadcn/ui](https://ui.shadcn.com/docs/components-json) (cross-checked
against [shadcn — CLI — shadcn/ui](https://ui.shadcn.com/docs/cli) and
[June 2023 — New CLI, Styles and more — shadcn/ui](https://ui.shadcn.com/docs/changelog/2023-06-new-cli))

### Base color / neutral palette options

- Documented in `components.json`'s `tailwind.baseColor` field (see above):
  `neutral`, `stone`, `zinc`, `mauve`, `olive`, `mist`, `taupe`.
  Source: [components.json — shadcn/ui](https://ui.shadcn.com/docs/components-json)
- Historically (June 2023 CLI introduction) the option set was `gray`, `neutral`, `slate`,
  `stone`, `zinc`.
  Source: [June 2023 — New CLI, Styles and more — shadcn/ui](https://ui.shadcn.com/docs/changelog/2023-06-new-cli)
- A full color-token reference in every format (including the base-color families) is also
  published at [Tailwind Colors in Every Format — shadcn/ui](https://ui.shadcn.com/colors).
- `baseColor` "cannot be changed after initialization" via the config file directly, but the CLI
  provides a migration command that "will rewrite the theme CSS variables and update the
  `baseColor` configuration for future component installations."
  Source: [components.json — shadcn/ui](https://ui.shadcn.com/docs/components-json)

### "new-york" vs "default" style

- The `style` field documentation states the choice "cannot be changed after initialization,"
  and only `new-york` is presented as the current valid option in the reference table.
  Source: [components.json — shadcn/ui](https://ui.shadcn.com/docs/components-json)
- Per search-indexed shadcn documentation: "We're deprecating the default style. New projects
  will use new-york." The original `default` style "was the original one used since the
  beginning of the project and uses lucide-react for icons and tailwindcss-animate for
  animations." The `new-york` style "ships with smaller buttons, cards with shadows," and now
  uses the unified `radix-ui` package instead of individual `@radix-ui/react-*` packages.
  Source: [February 2025 — Tailwind v4 — shadcn/ui](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4)
  (deprecation statement), [components.json — shadcn/ui](https://ui.shadcn.com/docs/components-json)
  (style-lock statement)
- **Conclusion for this finding:** as of this research date, `default` is being phased out /
  deprecated in shadcn/ui's own docs in favor of `new-york`, which is now the only style option
  documented in the `components.json` reference page.

---

## 2. WCAG 2.2 Level AA requirements relevant to a component design system

All text below is quoted directly from the W3C "Understanding WCAG 2.2" documents.

### 1.4.3 Contrast (Minimum) — Level AA

> "The visual presentation of text and images of text has a contrast ratio of at least 4.5:1,
> except for the following: Large Text: Large-scale text and images of large-scale text have a
> contrast ratio of at least 3:1"

- Normal text: **4.5:1** minimum contrast ratio.
- Large text: **3:1** minimum contrast ratio.
- "Large-scale" text is defined as at least **18 point**, or **14 point bold**, or an
  equivalent size for CJK fonts. Using the 1pt = 1.333px conversion, this is approximately
  **24px** (18pt) or **18.5px bold** (14pt bold).

Source: [Understanding SC 1.4.3: Contrast (Minimum) — W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

### 1.4.11 Non-text Contrast — Level AA

> "The visual presentation of the following have a contrast ratio of at least 3:1 against
> adjacent color(s): User Interface Components: Visual information required to identify user
> interface components and states, except for inactive components or where the appearance of
> the component is determined by the user agent and not modified by the author; Graphical
> Objects: Parts of graphics required to understand the content, except when a particular
> presentation of graphics is essential to the information being conveyed."

- Required ratio: **3:1** against adjacent color(s).
- Applies to: UI component boundaries/states needed to identify them (e.g. input borders,
  focus indicators, checkbox/radio outlines, toggle states) and graphical objects needed to
  understand content.
- Exceptions: inactive/disabled components, user-agent-default appearance (unmodified by the
  author), and graphics whose specific presentation is essential to the information conveyed.

Source: [Understanding SC 1.4.11: Non-text Contrast — W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

### 2.5.8 Target Size (Minimum) — Level AA (new in WCAG 2.2)

> "SC 2.5.8: The size of the target for pointer inputs is at least 24 by 24 CSS pixels"

Documented exceptions:

1. **Spacing** — "Undersized targets (those less than 24 by 24 CSS pixels) are positioned so
   that if a 24 CSS pixel diameter circle is centered on the bounding box of each, the circles
   do not intersect another target."
2. **Equivalent** — "The function can be achieved through a different control on the same page
   that meets this criterion."
3. **Inline** — "The target is in a sentence or its size is otherwise constrained by the
   line-height of non-target text."
4. **User Agent Control** — "The size of the target is determined by the user agent and is not
   modified by the author."
5. **Essential** — "A particular presentation of the target is essential or is legally required
   for the information being conveyed."

Source: [Understanding SC 2.5.8: Target Size (Minimum) — W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

### 2.4.11 Focus Not Obscured (Minimum) — Level AA (new in WCAG 2.2)

> "When a user interface component receives keyboard focus, the component is not entirely
> hidden due to author-created content."

Source: [Understanding SC 2.4.11: Focus Not Obscured (Minimum) — W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

### 2.4.7 Focus Visible — Level AA

> "Any keyboard operable user interface has a mode of operation where the keyboard focus
> indicator is visible."

Source: [Understanding SC 2.4.7: Focus Visible — W3C WAI](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)

The W3C quick-reference index for all criteria (filterable by level/topic) is at
[WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/).

---

## 3. Nielsen Norman Group guidance

### (a) Mobile-first / responsive form design

**"Website Forms Usability: Top 10 Recommendations"** — Kathryn Whitenton, May 1, 2016.
Source: https://www.nngroup.com/articles/web-form-design/

Concrete recommendations:

- Minimize the number of fields; the article cites an example of a form "reduced ... from 6
  fields down to only 2 fields," which directly improved conversion.
- Label placement: "Labels should be close to the fields they describe (immediately above the
  field for mobile and shorter desktop forms, or next to the field for extremely long desktop
  forms)."
- Use a single-column layout: "Multiple columns interrupt the vertical momentum of moving down
  the form" (exception: short related fields like city/state/zip can sit in one row).
- Size fields to the expected input: "Text fields should be about the same size as the
  expected input since it's extremely error prone when users can't see their full entry."
- Avoid placeholder text as a label substitute — it "causes many usability problems."
- Limit optional fields to 1–2 and label them explicitly rather than making users guess
  requirements.
- Remove Reset/Clear buttons: "The risk of accidental deletion outweighs the unlikely need to
  'start over' on a web form."
- State exact format requirements up front ("Don't make users guess your obscure password
  requirements.").
- Forms following these guidelines in NN/g's research achieved **78% one-try submissions**
  versus **42%** for non-compliant forms.

**"Mobile First Is NOT Mobile Only"** — Raluca Budiu and Kara Pernice, July 24, 2016.
Source: https://www.nngroup.com/articles/mobile-first-not-mobile-only/

Concrete recommendations (general responsive-design guidance, not form-specific, but directly
relevant to a mobile-first component system):

- Don't blindly transplant mobile UI conventions (e.g. hamburger menus, hidden navigation,
  search icons in place of visible search boxes) onto desktop layouts — doing so degrades
  desktop usability (their study found navigation elements were used far more on the mobile
  version of a site than the desktop version of the _same_ site — 77% vs 54% — because the
  desktop navigation had been degraded by mobile-first porting).
- "Different devices have different capabilities of interaction and different screen sizes,"
  which argues for platform-adapted layouts rather than one identical UI stretched across
  breakpoints.
- "Providing content and feature parity across devices is a great goal, but it doesn't mean
  that all the UI elements and the design must also stay exactly the same."

### (b) Form validation / error-state UX patterns

**"10 Design Guidelines for Reporting Errors in Forms"** — Rachel Krause, published February 3,
2019, last reviewed December 12, 2024.
Source: https://www.nngroup.com/articles/errors-forms-design-guidelines/

Concrete recommendations:

- Validation timing: "Ideally, all validation should be inline; that is, as soon as the user
  has finished filling in a field, an indicator should appear nearby if the field contains an
  error" — but "avoid showing an error until the user has finished with the field and moved to
  the next field" (i.e., validate on blur, not on every keystroke while the user is still
  typing).
- Error message placement: place the message "below or next to the problem field in order to
  help the user fix the error." Rationale given: keeping the message adjacent to the field
  "minimizes working-memory load: users can see the error message while fixing the error
  instead of having to remember it."
- Validation summaries (e.g. a top-of-form list of all errors) should not be used as the sole
  error indicator, because they "force the user to search for the field in error."

**"Error-Message Guidelines"** — Tim Neusesser and Evan Sunwall, May 14, 2023.
Source: https://www.nngroup.com/articles/error-message-guidelines/

Concrete recommendations:

- Visibility: "Display the error message close to the error's source"; use bold, high-contrast
  styling with icons; match message severity to impact (banners for minor issues, modals for
  critical errors); avoid showing errors prematurely.
- Communication: use plain language, avoid technical jargon/error codes in the user-facing
  message; describe the exact problem rather than a generic "An error occurred"; provide a
  constructive path to resolution rather than just naming the problem; do not blame the user —
  explicitly: "Don't use phrasing that blames users or implies they are doing something wrong,
  such as invalid, illegal, or incorrect."
- Efficiency: detect likely mistakes before they cascade; preserve user input across error
  states so users don't have to re-enter data; where feasible, suggest the correction directly;
  "Let users correct errors by editing their original action instead of starting over."

---

## 4. Mobile touch target size cross-check

### Apple Human Interface Guidelines

> "As a general rule, a button needs a hit region of at least 44x44 pt — in visionOS, 60x60 pt —
> to ensure that people can select it easily, whether they use a fingertip, a pointer, their
> eyes, or a remote."

Source: [Buttons — Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/buttons)
(page change log shows this guidance current as of "December 16, 2025 — Updated guidance for
Liquid Glass")

- Minimum hit region: **44 × 44 pt** on iOS/iPadOS/macOS/watchOS/tvOS.
- visionOS-specific minimum: **60 × 60 pt**, and visionOS additionally recommends button
  centers be "at least 60 points apart."

### Google Material Design 3

> "For most platforms, consider making touch targets at least 48 x 48dp. A touch target this
> size results in a physical size of about 9mm, regardless of screen size. The recommended
> target size for touchscreen elements is 7-10mm."
>
> "Note: iOS recommends 44 x 44dp targets."
>
> "Pointer targets ... Consider making pointer targets minimums 44 x 44dp."
>
> "In most cases, targets separated by 8dp of space or more promote balanced information
> density and usability."

Source: [Accessibility designing — Material Design 3](https://m3.material.io/foundations/designing/structure)
(§ "Target sizes")

- Minimum touch target (touchscreen): **48 × 48 dp**.
- Minimum pointer target (mouse/stylus): **44 × 44 dp**.
- Recommended minimum spacing between adjacent targets: **8 dp**.
- Material's own docs explicitly note the platform discrepancy with Apple (44dp vs 48dp).

### Numeric comparison against WCAG 2.2 SC 2.5.8

| Source                                            | Minimum target size | Unit   |
| ------------------------------------------------- | ------------------- | ------ |
| WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA | 24 × 24             | CSS px |
| Apple HIG (iOS/iPadOS/macOS/watchOS/tvOS)         | 44 × 44             | pt     |
| Apple HIG (visionOS)                              | 60 × 60             | pt     |
| Material Design 3 (touch target)                  | 48 × 48             | dp     |
| Material Design 3 (pointer target)                | 44 × 44             | dp     |

At a standard 1x/baseline density, CSS px, iOS pt, and Android/Material dp are all
approximately 1:1 as abstract units (each is a density-independent unit designed so 1 unit ≈
1/96–1/160in depending on platform convention). On that basis, both Apple's 44×44 and
Material's 48×48 platform minimums are numerically larger than the WCAG 2.2 24×24 CSS px
_minimum_ (WCAG 2.2 states 24×24 CSS px as a pass/fail floor for conformance, not as a
recommended/ideal size — the spacing exception in SC 2.5.8 also allows smaller-than-24px
targets if they are spaced so a 24px circle centered on each does not intersect another
target).

---

## 5. lucide-react icon library

- shadcn/ui's own icon-migration changelog states: "The new-york style now uses Lucide as the
  default icon set," and "New projects will use Lucide by default," while noting "No breaking
  changes for existing projects."
  Source: [November 2024 — Icons — shadcn/ui](https://ui.shadcn.com/docs/changelog/2024-11-icons)
- The `components.json` reference documents an `iconLibrary` field used by the CLI so that
  future `npx shadcn add` installs pull icons from the configured library.
  Source: [components.json — shadcn/ui](https://ui.shadcn.com/docs/components-json)
- The CLI docs describe a dedicated migration command for switching icon libraries: "The
  following libraries are supported: `lucide`, `tabler`, `hugeicons`, `phosphor`, `remixicon`
  and `radix` (legacy)." Running the migration "will prompt you for the source and target
  libraries, rewrite icon imports and JSX usage in your `ui` directory, install the target
  library and update `iconLibrary` in your `components.json` so future `npx shadcn add`
  installs use the new library." Non-interactive migration is supported via `--from`/`--to`
  flags.
  Source: [shadcn — CLI — shadcn/ui](https://ui.shadcn.com/docs/cli)
- Per the historical style description (June 2023 changelog / Tailwind v4 changelog context),
  the original `default` style "uses lucide-react for icons," and lucide has since become the
  default for the now-primary `new-york` style as well — i.e. lucide-react is shadcn/ui's
  consistent default icon library across styles as of this research date.
  Source: [February 2025 — Tailwind v4 — shadcn/ui](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4),
  [November 2024 — Icons — shadcn/ui](https://ui.shadcn.com/docs/changelog/2024-11-icons)
- Generated shadcn/ui components (e.g. the `Item` component) import icons directly from
  `lucide-react` in JSX, e.g. icon names such as `BadgeCheckIcon` and `ChevronRightIcon` are
  used inline in component source shown in the docs.
  Source: [Item — shadcn/ui](https://ui.shadcn.com/docs/components/base/item)

---

## References

### shadcn/ui

- https://ui.shadcn.com/docs/installation/next
- https://ui.shadcn.com/docs/installation
- https://ui.shadcn.com/docs/theming
- https://ui.shadcn.com/docs/components-json
- https://ui.shadcn.com/docs/tailwind-v4
- https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4
- https://ui.shadcn.com/docs/changelog/2024-11-icons
- https://ui.shadcn.com/docs/changelog/2023-06-new-cli
- https://ui.shadcn.com/docs/cli
- https://ui.shadcn.com/docs/components/base/item
- https://ui.shadcn.com/colors

### WCAG 2.2 (W3C)

- https://www.w3.org/WAI/WCAG22/quickref/
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html

### Nielsen Norman Group

- https://www.nngroup.com/articles/web-form-design/
- https://www.nngroup.com/articles/mobile-first-not-mobile-only/
- https://www.nngroup.com/articles/errors-forms-design-guidelines/
- https://www.nngroup.com/articles/error-message-guidelines/

### Touch target size

- https://developer.apple.com/design/human-interface-guidelines/buttons
- https://developer.apple.com/design/human-interface-guidelines/layout
- https://m3.material.io/foundations/designing/structure
- https://m3.material.io/foundations/accessible-design/overview
